import { JsonValueParser } from './index'

/**
 * State machine that reads a JSON number.
 */
export default function * NumberStateMachine (): JsonValueParser {
	const charArray: string[] = []
	let chunk: string
	while ((chunk = yield)) {
		if (!chunk || !chunk.length) continue
		for (let i = 0; i < chunk.length; i++) {
			const char = chunk.charAt(i)
			if (!char.match(/[0-9.eE+-]/)) {
				const str = charArray.join('')
				const result = Number(str)
				const nan = Number.isNaN(result)
				if (nan) throw new Error(`${str} is not a number!`)
				const rest = chunk.slice(i)
				return {
					result,
					rest
				}
			} else charArray.push(char)
		}
	}
	throw new Error('Invalid number')
}
