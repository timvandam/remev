import { chooseStateMachine, JsonValue, JsonValueParser, ReadResult } from './index'

enum EObjectState {
	EXPECTING_VALUE,
	EXPECTING_KEY, // p much same as expecting string
	EXPECTING_COLON,
	EXPECTING_COMMA
}

export default function * ObjectStateMachine (): JsonValueParser {
	let chunk = yield
	chunk = chunk.slice(1) // remove the {

	const result: Record<string, JsonValue> = {}
	let stateMachine: JsonValueParser | null = null
	let state = EObjectState.EXPECTING_KEY as EObjectState
	let key: string | null = null
	let i = 0
	do {
		if (!chunk || !chunk.length) continue
		for (i = 0; i < chunk.length; i++) {
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
					if (char !== ',') throw new Error(`Invalid object - expected a comma but found ${char}`)
					state = EObjectState.EXPECTING_KEY
					break
				}

				case EObjectState.EXPECTING_COLON: {
					if (char !== ':') throw new Error(`Invalid object - expected a colon but found ${char}`)
					state = EObjectState.EXPECTING_VALUE
					break
				}

				case EObjectState.EXPECTING_KEY: {
					// Ensure that a string state machine is used
					stateMachine = stateMachine ?? chooseStateMachine('"') as JsonValueParser

					const { done, value } = stateMachine.next(chunk.slice(i)) as { done: boolean, value: ReadResult }
					if (done) {
						key = value.result as string
						finishReading(value, EObjectState.EXPECTING_COLON)
					}

					break
				}

				case EObjectState.EXPECTING_VALUE: {
					stateMachine = stateMachine ?? chooseStateMachine(char)
					if (!stateMachine) throw new Error(`Invalid character ${char} in object`)

					const { done, value } = stateMachine.next(chunk.slice(i)) as { done: boolean, value: ReadResult }
					if (done) {
						if (key === null) throw new Error('Invalid object - attempted to write value without knowing its key')
						result[key] = value.result
						key = null
						finishReading(value, EObjectState.EXPECTING_COMMA)
					}

					break
				}

				default: throw new Error(`Invalid object state ${state}`)
			}
		}
	} while ((chunk = yield))
	throw new Error('Invalid object!')

	/**
	 * Reset StateMachine, read leftover from reading as the next chunk, update state.
	 */
	function finishReading ({ rest }: ReadResult, nextState: EObjectState): void {
		stateMachine = null
		chunk = rest
		i = -1
		state = nextState
	}
}
