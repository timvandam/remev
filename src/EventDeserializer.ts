import RemoteEventEmitter from './index'
import JsonDeserializer from './JsonDeserializer'
import net from 'net'

/**
 * Reads incoming events and emits them on the provided RemoteEventEmitter.
 */
export default async function EventDeserializer (socket: net.Socket, remoteEventEmitter: RemoteEventEmitter) {
	const jsonDeserializer = new JsonDeserializer()
	const events = socket.pipe(jsonDeserializer)
	for await (const { event, args = [] } of events) {
		if (!event) continue
		remoteEventEmitter.silentEmit(event, ...args)
	}
}
