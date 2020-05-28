import { EventEmitter } from 'events'
import net from 'net'
import EventDeserializer from './EventDeserializer'

/**
 * EventEmitter that listens to events emitted on connected RemoteEventEmitters and can emit them respectively.
 */
export default class RemoteEventEmitter extends EventEmitter {
	private sockets: net.Socket[] = []
	private server?: net.Server

	/**
	 * Establishes a new connection to another RemoteEventEmitter
	 */
	connect (host: string, port: number = 13567): net.Socket {
		const socket = net.createConnection(port, host)
		socket.pipe(new EventDeserializer(this)) // pipe to deserializer that will do the local emitting
		this.sockets.push(socket)
		return socket
	}
}
