import RemoteEventEmitter from './index'
import JsonDeserializer from './JsonDeserializer'
import net from 'net'

/**
 * Reads incoming events and emits them on the provided RemoteEventEmitter.
 */
export default async function EventDeserializer (socket: net.Socket, remoteEventEmitter: RemoteEventEmitter) {
	const jsonDeserializer = new JsonDeserializer()
	const events = socket.pipe(jsonDeserializer)

	// Whenever a JSON value is parsed (= a remote event has been read), emit it to the local REE
	for await (const { event, args = [] } of events) {
		if (!event) continue
		// If this were a normal emit it would infinitely loop between clients
		remoteEventEmitter.silentEmit(event, ...args)
	}
}
