import { Duplex } from 'stream'
import { ValueOpeners } from './ValueOpeners'

interface JsonObject {
	[key: string]: JsonValue;
}

export type JsonValue = string | number | JsonObject | JsonValue[];

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
	private results: JsonValue[] = []

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

	/**
	 * If there is a result, provide it and then delete the result again
	 */
	_read (): void {
		this.canPush = true
		this.pushResults()
	}

	/**
	 * Pushes results while able to.
	 */
	private pushResults (): void {
		while (this.canPush && this.results.length) {
			this.canPush = this.push(this.results.shift())
		}
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
			this.results.push(value.result)
			this.pushResults()
			this.stateMachine = null
			if (value.rest) this._write(Buffer.from(value.rest, 'utf8'), 'utf8', callback)
			else callback()
		} else callback()
	}
}
