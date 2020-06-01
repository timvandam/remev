import EventDeserializer from '../EventDeserializer'
import RemoteEventEmitter from '../index'
import net from 'net'
import JsonDeserializer, { JsonValue } from '../JsonDeserializer'

class MockJsonDeserializer extends JsonDeserializer {
	public pushResult (result: JsonValue) {
		this.results.push(result)
		this.pushResults()
	}
}

let socket: net.Socket
let remev: RemoteEventEmitter
let jsonDeserializer: MockJsonDeserializer
let eventDeserializer: Promise<void>

const waitForIteration = () =>
	new Promise(resolve =>
		jsonDeserializer.once('data', () => setImmediate(resolve)))

beforeEach(() => {
	socket = new net.Socket()
	remev = new RemoteEventEmitter()
	jsonDeserializer = new MockJsonDeserializer()
	eventDeserializer = EventDeserializer(socket, remev, jsonDeserializer)
})

it('silently emits when receiving an event', async () => {
	jest.spyOn(remev, 'silentEmit')

	expect(remev.silentEmit).toHaveBeenCalledTimes(0)

	jsonDeserializer.pushResult({ event: 'hello', args: ['arg', 2] })
	await waitForIteration()

	expect(remev.silentEmit).toHaveBeenCalledTimes(1)
	expect(remev.silentEmit).toHaveBeenCalledWith('hello', 'arg', 2)
}, 300)

it('ignores nameless events', async () => {
	jest.spyOn(remev, 'silentEmit')

	expect(remev.silentEmit).toHaveBeenCalledTimes(0)

	jsonDeserializer.pushResult({ hello: true })
	await waitForIteration()

	expect(remev.silentEmit).toHaveBeenCalledTimes(0)
})

it('works without arguments', async () => {
	jest.spyOn(remev, 'silentEmit')

	jsonDeserializer.pushResult({ event: 'e' })
	await waitForIteration()

	expect(remev.silentEmit).toHaveBeenCalledWith('e')
})
