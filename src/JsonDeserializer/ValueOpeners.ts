import StringStateMachine from './StringStateMachine'
import ArrayStateMachine from './ArrayStateMachine'
import ObjectStateMachine from './ObjectStateMachine'
import NumberStateMachine from './NumberStateMachine'
import { JsonValueParser } from './index'

export const ValueOpeners: Record<string, () => JsonValueParser> = {
	'"': StringStateMachine,
	'[': ArrayStateMachine,
	'{': ObjectStateMachine
}

for (let i = 1; i <= 9; i++) ValueOpeners[i] = NumberStateMachine
