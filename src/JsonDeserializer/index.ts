import { Duplex } from 'stream'
import { ValueOpeners } from './ValueOpeners'

export type JsonValue = string | number | object | JsonValue[];

export interface ReadResult {
	result: JsonValue;
	rest: string;
}

export type JsonValueParser = Generator<void, ReadResult, string>

/**
 * Initializes a state machine for the given character
 */
export function chooseStateMachine (char: string): JsonValueParser|null {
	const stateMachine = ValueOpeners[char]?.() ?? null
	if (stateMachine) stateMachine.next() // initialize the state machine.
	return stateMachine
}

/**
 * Parses a JSON string (or utf8 buffer) as a JS object.
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
	 * Sets a state machine if has not yet been set. Returns the part to be read
	 */
	private setStateMachine (chunk: string): string {
		if (this.stateMachine) throw new Error('State machine has already been set')

		chunk = chunk.replace(/^\s*/, '') // remove leading whitespaces
		this.stateMachine = chooseStateMachine(chunk.charAt(0))

		if (!this.stateMachine) throw new Error(`Invalid character ${chunk.charAt(0)}`)

		return chunk
	}

	_read () {
		this.canPush = true
		if (this.resultRead) this.canPush = this.push(null)
		else if (this.result) this.canPush = (this.resultRead = true) && this.push(this.result) && this.push(null)
	}

	/**
	 * Before closing give the state machine another ' ' to indicate that the end has been reached. This is needed for
	 * individual numbers as they only end once a non-number is supplied (e.g. a whitespace)
	 */
	_final (callback: (error?: (Error | null)) => void) {
		if (!this.resultRead && this.stateMachine) {
			const { done, value } = this.stateMachine.next(' ') as { done: boolean, value: ReadResult }
			if (done) {
				this.result = value.result
				this.canPush = this.canPush && (this.resultRead = true) && this.push(this.result) && this.push(null)
			}
		}
		if (this.result === undefined) callback(new Error('Invalid JSON - are all strings/arrays/objects closed?'))
		else callback()
	}

	_write (chunk: Buffer, encoding: BufferEncoding, callback: (error?: (Error | null)) => void): void {
		let str = chunk.toString('utf8')

		// No state machine? Set it!
		if (!this.stateMachine) str = this.setStateMachine(str)

		// This error can't happen as setStateMachine would already have thrown, but typescript doesn't know that
		if (!this.stateMachine) throw new Error('Invalid json - this error should not have happened')

		// Feed characters into the state machine
		const { done, value } = this.stateMachine.next(str) as { done: boolean, value: ReadResult }
		// If the value has successfully been parsed push it or save it for later if it cant be pushed yet
		if (done) {
			this.result = value.result
			this.canPush = this.canPush && (this.resultRead = true) && this.push(this.result) && this.push(null)
			this.end()
		}
		callback()
	}
}
