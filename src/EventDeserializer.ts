import { Writable } from 'stream'
import RemoteEventEmitter from './index'

/**
 * Reads incoming packets as events and emits them on the provided RemoteEventEmitter.
 */
export default class EventDeserializer extends Writable {
	constructor (private remoteEventEmitter: RemoteEventEmitter) {
		super()
	}

	/**
	 * Buffer format: Length
	 */
	_write (chunk: Buffer, encoding: BufferEncoding, callback: (error?: (Error | null)) => void): void {
		const event = 'asd'
		const args: any[] = []
		callback()
		this.remoteEventEmitter.emit(event, ...args)
	}
}
