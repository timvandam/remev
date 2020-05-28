import { chooseStateMachine, JsonValue, JsonValueParser, ReadResult } from './index'

export enum EArrayState {
	EXPECTING_VALUE,
	EXPECTING_COMMA
}

/**
 * State machine that reads JSON arrays
 */
export default function * ArrayStateMachine (): JsonValueParser {
	let chunk = yield
	chunk = chunk.slice(1) // remove the first [

	const result: JsonValue[] = []
	let stateMachine: JsonValueParser|null = null // used for reading children of this array
	let state = EArrayState.EXPECTING_VALUE
	do {
		if (!chunk || !chunk.length) continue
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
					if (char !== ',') throw new Error(`Invalid array - expected comma but found ${char}`)
					state = EArrayState.EXPECTING_VALUE

					break
				}

				case EArrayState.EXPECTING_VALUE: {
					// At this point we're expecting a value, so let's look for one!
					stateMachine = stateMachine ?? chooseStateMachine(char)
					if (!stateMachine) throw new Error(`Invalid character ${char} in array`)

					// We have a state machine, lets provide the entire remaining chunk
					const { done, value } = stateMachine.next(chunk.slice(i)) as { done: boolean, value: ReadResult }

					// If it's done we can simply start analyzing the rest
					if (done) {
						result.push(value.result)
						stateMachine = null
						chunk = value.rest
						i = -1 // -1 because i++ will set it to 0
						state = EArrayState.EXPECTING_COMMA
					}

					break
				}

				default: throw new Error(`Invalid state ${state}`)
			}
		}
	} while ((chunk = yield))
	throw new Error('Invalid array!')
}
