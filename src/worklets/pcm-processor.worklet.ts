/**
 * AudioWorklet processor: converts Float32 mic audio → PCM16LE binary frames.
 * Runs on the audio rendering thread for low-latency capture.
 * Sends Int16Array buffers to the main thread via postMessage.
 */

class PCMProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    const buf = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      buf[i] = Math.max(-32768, Math.min(32767, channel[i] * 32768));
    }
    // Transfer the buffer (zero-copy) to the main thread
    this.port.postMessage(buf.buffer, [buf.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
