import { Duplex, Writable } from 'stream'

type JsonValue = string | number | object | JsonValue[];

interface ReadResult {
	result: JsonValue;
	rest: string;
}

type JsonValueParser = Generator<void, ReadResult, string>

function * NumberStateMachine (): JsonValueParser {
	const charArray: string[] = []
	let start = false
	let done = false
	let chunk: string
	while ((chunk = yield)) {
		let i
		if (!chunk || !chunk.length) continue
		if (!start) {
			if (chunk.charAt(0).match(/[1-9]/)) {
				start = true
			} else throw new Error('Not a number!')
		}
		for (i = 0; i < chunk.length; i++) {
			const char = chunk.charAt(i)
			if (!char.match(/[0-9.eE+-]/)) {
				done = true
				break
			} else charArray.push(char)
		}

		if (!done) continue
		const str = charArray.join('')
		const result = Number(str)
		const nan = Number.isNaN(result)
		if (nan) throw new Error('Not a number!')
		const rest = chunk.slice(i)
		return {
			result,
			rest
		}
	}
	throw new Error('Invalid number')
}

function * StringStateMachine (): JsonValueParser {
	const charArray: string[] = []
	let start = false
	let escape = false
	let done = false
	let chunk: string
	while ((chunk = yield)) {
		let i
		if (!chunk || !chunk.length) continue
		if (!start) {
			if (chunk.charAt(0) === '"') {
				start = true
				chunk = chunk.slice(1)
			} else throw new Error('Not a string!')
		}
		for (i = 0; i < chunk.length; i++) {
			const char = chunk.charAt(i)
			if (escape) {
				charArray.push(char)
				escape = false
				continue
			}
			if (char === '\\') {
				escape = true
				continue
			}
			if (char === '"') {
				done = true
				break
			}
			charArray.push(char)
		}

		if (!done) continue
		const result = charArray.join('')
		const rest = chunk.slice(i + 1)
		return {
			result,
			rest
		}
	}
	throw new Error('Invalid string')
}

enum EArrayState {
	EXPECTING_VALUE,
	EXPECTING_COMMA
}

function * ArrayStateMachine (): JsonValueParser {
	const result: JsonValue[] = []
	let start = false
	let chunk: string = ''
	let stateMachine: JsonValueParser|null = null
	let state = EArrayState.EXPECTING_VALUE
	while ((chunk = yield)) {
		if (!chunk || !chunk.length) continue
		if (!start) {
			if (chunk.charAt(0) === '[') {
				start = true
				chunk = chunk.slice(1)
			} else throw new Error('Not an array!')
		}
		for (let i = 0; i < chunk.length; i++) {
			const char = chunk.charAt(i)

			// If we're not reading at the moment the array might close & whitespaces are allowed
			if (!stateMachine) {
				if (char.match(/\s/)) continue // ignore whitespaces while looking for a comma
				if (char === ']') {
					return {
						result,
						rest: chunk.slice(i + 1)
					}
				}
			}

			switch (state) {
				case EArrayState.EXPECTING_COMMA: {
					if (char !== ',') throw new Error('Invalid array!')
					state = EArrayState.EXPECTING_VALUE
					continue
				}

				case EArrayState.EXPECTING_VALUE: {
					// At this point we're expecting a value, so let's look for one!
					stateMachine = stateMachine ?? chooseStateMachine(char)
					if (!stateMachine) throw new Error(`Invalid character ${char} in array`)

					// We have a state machine, lets provide the entire remaining chunk
					const { done, value } = stateMachine.next(chunk.slice(i))

					// If it's done we can simply start analyzing the rest
					if (done) {
						result.push((value as ReadResult).result)
						stateMachine = null
						chunk = (value as ReadResult).rest
						i = -1 // -1 because i++ will set it to 0
						state = EArrayState.EXPECTING_COMMA
					}

					break
				}

				default: throw new Error(`Invalid state ${state}`)
			}
		}
	}
	throw new Error('Invalid array!')
}

enum EObjectState {
	EXPECTING_VALUE,
	EXPECTING_KEY, // p much same as expecting string
	EXPECTING_COLON,
	EXPECTING_COMMA
}

function * ObjectStateMachine (): JsonValueParser {
	const result: Record<string, JsonValue> = {}
	let start = false
	let chunk: string | null = null
	let stateMachine: JsonValueParser | null = null
	let state = EObjectState.EXPECTING_KEY as EObjectState
	let key: string | null = null
	while ((chunk = yield)) {
		if (!chunk || !chunk.length) continue
		if (!start) {
			if (chunk.charAt(0) === '{') {
				start = true
				chunk = chunk.slice(1)
			} else throw new Error('Not an object!')
		}
		for (let i = 0; i < chunk.length; i++) {
			const char = chunk.charAt(i)

			// Not reading? Check if the object ends
			if (!stateMachine || (stateMachine && EObjectState.EXPECTING_KEY)) {
				if (char.match(/\s/)) continue // ignore whitespaces
				if (char === '}') {
					return {
						result,
						rest: chunk.slice(i + 1)
					}
				}
			}

			switch (state) {
				case EObjectState.EXPECTING_COMMA: {
					if (char !== ',') throw new Error('Invalid object!')
					state = EObjectState.EXPECTING_KEY
					continue
				}

				case EObjectState.EXPECTING_COLON: {
					if (char !== ':') throw new Error('Invalid object!')
					state = EObjectState.EXPECTING_VALUE
					continue
				}

				case EObjectState.EXPECTING_KEY: {
					// Ensure that a string state machine is used
					stateMachine = stateMachine ?? chooseStateMachine('"') as JsonValueParser

					const { done, value } = stateMachine.next(chunk.slice(i))
					if (done) {
						key = (value as ReadResult).result as string
						stateMachine = null
						chunk = (value as ReadResult).rest
						i = -1
						state = EObjectState.EXPECTING_COLON
					}

					break
				}

				case EObjectState.EXPECTING_VALUE: {
					stateMachine = stateMachine ?? chooseStateMachine(char)
					if (!stateMachine) throw new Error(`Invalid character ${char} in object`)

					const { done, value } = stateMachine.next(chunk.slice(i))
					if (done) {
						if (!key) throw new Error('Invalid object')
						result[key] = (value as ReadResult).result
						stateMachine = null
						chunk = (value as ReadResult).rest
						key = null
						i = -1
						state = EObjectState.EXPECTING_COMMA
					}

					break
				}

				default: throw new Error(`Invalid state ${state}`)
			}
		}
	}
	throw new Error('Invalid object!')
}

/**
 * Chooses a state machine to read characters following the given character.
 */
function chooseStateMachine (char: string): JsonValueParser|null {
	let stateMachine: JsonValueParser|null = null
	switch (char) {
		case '"': {
			stateMachine = StringStateMachine()
			break
		}

		case '1':
		case '2':
		case '3':
		case '4':
		case '5':
		case '6':
		case '7':
		case '8':
		case '9': {
			stateMachine = NumberStateMachine()
			break
		}

		case '[': {
			stateMachine = ArrayStateMachine()
			break
		}

		case '{': {
			stateMachine = ObjectStateMachine()
			break
		}
	}

	if (stateMachine) stateMachine.next() // initialize the state machine.
	return stateMachine
}

/**
 * Parses a JSON string (in the form of a buffer) as a JS object.
 */
export default class JsonDeserializer extends Duplex {
	// we only need to store one state machine. if the provided thing is an object the object state machine will simply
	// use other state machines to read the other stuff
	private stateMachine: JsonValueParser|null = null
	private canPush = false
	private result: any
	private resultRead = false

	constructor () {
		super({ readableObjectMode: true })
	}

	/**
	 * Sets a state machine if has not yet been set. Returns the leftover part.
	 */
	private setStateMachine (chunk: string): string {
		if (this.stateMachine) throw new Error('State machine has already been set')
		let i: number
		for (i = 0; i < chunk.length; i++) {
			const char = chunk.charAt(i)
			if (char.match(/\s/)) continue
			this.stateMachine = chooseStateMachine(char)
			if (this.stateMachine) break
		}

		return chunk.slice(i)
	}

	_read () {
		this.canPush = true
		if (this.resultRead) this.canPush = this.push(null)
		else if (this.result) {
			this.resultRead = true
			this.canPush = this.push(this.result) && this.push(null)
		}
	}

	/**
	 * Before closing give the state machine another ' ' to indicate that the end has been reached. This is needed for
	 * individual numbers as they only end once a non-number is supplied (e.g. a whitespace)
	 */
	_final (callback: (error?: (Error | null)) => void) {
		if (!this.resultRead && this.stateMachine) {
			const { done, value } = this.stateMachine.next(' ')
			if (done) {
				this.result = (value as ReadResult).result
				this.canPush = this.canPush && this.push(this.result) && this.push(null) && (this.resultRead = true)
			}
		}
		callback()
	}

	_write (chunk: Buffer, encoding: BufferEncoding, callback: (error?: (Error | null)) => void): void {
		let str = chunk.toString('utf8')

		// No state machine? Set it!
		if (!this.stateMachine) str = this.setStateMachine(str)

		// If no state machine has been set by now the provided chunk is invalid
		if (!this.stateMachine) {
			callback(new Error('Invalid json!'))
			return
		}

		// Feed characters into the state machine
		const { done, value } = this.stateMachine.next(str)
		// If the value has successfully been parsed push it or save it for later if it cant be pushed yet
		if (done) {
			this.result = (value as ReadResult).result
			this.canPush = this.canPush && this.push(this.result) && this.push(null) && (this.resultRead = true)
			this.end()
		}
		callback()
	}
}

const j = new JsonDeserializer()
j.pipe(new Writable({
	objectMode: true,
	write (chunk) {
		console.log(chunk)
	}
}))
j.end('{"hello":[123, "321"]}')
