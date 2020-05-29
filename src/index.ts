import { EventEmitter } from 'events'
import net from 'net'
import EventDeserializer from './EventDeserializer'
import { JsonValue } from './JsonDeserializer'

/**
 * EventEmitter that listens to events emitted on connected RemoteEventEmitters and can emit them respectively.
 */
export default class RemoteEventEmitter extends EventEmitter {
	private static EMIT = Symbol('ree_emit') // used to emit to REEs connected to this REE

	private sockets = new Set<net.Socket>() // our sockets that are connected to other REEs
	private server?: net.Server // our server that allows other REEs to connect

	/**
	 * Converts an event into a buffer
	 */
	private static eventToBuffer (event: string | symbol, ...args: any[]) {
		return Buffer.from(JSON.stringify({ event, args }), 'utf8')
	}

	/**
	 * Emits without any broadcasting (calls super.emit)
	 */
	silentEmit (event: string | symbol, ...args: any): boolean {
		return super.emit(event, ...args)
	}

	/**
	 * Emits an event and broadcasts it to all connected sockets
	 */
	emit (event: string | symbol, ...args: JsonValue[]): boolean {
		// Send event to all REEs this REE is connected to
		const buf = RemoteEventEmitter.eventToBuffer(event, ...args)
		this.sockets.forEach(socket => socket.write(buf))

		// Send event to all REEs connected to this REE
		super.emit(RemoteEventEmitter.EMIT, buf)

		return super.emit(event, ...args)
	}

	/**
	 * Establishes a new connection to another RemoteEventEmitter.
	 */
	connect (host: string, port: number = 13567): net.Socket {
		const socket = net.createConnection(port, host)
		EventDeserializer(socket, this) // read events and emit them

		// Add socket to the socket list, remove if it disconnects
		this.sockets.add(socket)
		socket.on('close', () => this.sockets.delete(socket))

		return socket
	}

	/**
	 * Allows sockets to connect to this RemoteEventEmitter.
	 */
	open (port: number = 13567) {
		if (this.server) throw new Error('This RemoteEventEmitter is already open!')
		this.server = net.createServer(socket => {
			this.on(RemoteEventEmitter.EMIT, emit)

			EventDeserializer(socket, this)

			socket.on('close', () => {
				this.off(RemoteEventEmitter.EMIT, emit)
			})

			function emit (buf: Buffer) {
				socket.write(buf)
			}
		})

		this.server.listen(port)
	}
}
