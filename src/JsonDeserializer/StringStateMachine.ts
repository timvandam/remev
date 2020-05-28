import { JsonValueParser } from './index'

/**
 * State machine that reads a JSON string.
 */
export default function * StringStateMachine (): JsonValueParser {
	let chunk = yield
	chunk = chunk.slice(1) // remove the first "

	const charArray: string[] = []
	let escape = false
	do {
		if (!chunk || !chunk.length) continue
		for (let i = 0; i < chunk.length; i++) {
			const char = chunk.charAt(i)

			if (escape) {
				charArray.push(char)
				escape = false
				continue
			}

			switch (char) {
				case '\\': {
					escape = true
					break
				}

				case '"': {
					const result = charArray.join('')
					const rest = chunk.slice(i + 1)
					return {
						result,
						rest
					}
				}

				default: charArray.push(char)
			}
		}
	} while ((chunk = yield))
	throw new Error('Invalid string')
}
