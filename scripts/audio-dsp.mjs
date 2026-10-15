// Blend the tail into the head once at decode time, rather than jumping between
// unrelated samples on every loop. Keep the original recording unchanged.
export function frictionLoop(ctx, buffer) {
    const margin = Math.round(buffer.sampleRate * .035), start = Math.min(margin, Math.floor(buffer.length / 8));
    const end = buffer.length - start, overlap = Math.min(Math.round(buffer.sampleRate * .025), Math.floor((end - start) / 4));
    if (overlap < 2)
        return buffer;
    const length = end - start - overlap, out = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const input = buffer.getChannelData(channel), output = out.getChannelData(channel);
        for (let i = 0; i < overlap; i++) {
            const blend = i / (overlap - 1);
            output[i] = input[end - overlap + i] * (1 - blend) + input[start + i] * blend;
        }
        output.set(input.subarray(start + overlap, end - overlap), overlap);
    }
    return out;
}
// Original modal synthesis for UI/reward feedback; no external sample licence.
// One buffer per cue keeps the voice limit predictable, including the win phrase.
export function cueBuffer(ctx, kind) {
    const notes = kind === 'win' ? [523.25, 659.25, 783.99] : kind === 'tool' ? [659.25, 987.77] : kind === 'clear' ? [783.99, 1046.5] : kind === 'align' ? [1174.66] : [880];
    const spacing = kind === 'win' ? .16 : .065, duration = kind === 'button' ? .065 : kind === 'align' ? .11 : .3;
    const rate = ctx.sampleRate || 44100, length = Math.ceil((duration + spacing * (notes.length - 1)) * rate);
    const out = ctx.createBuffer(1, length, rate), data = out.getChannelData(0);
    notes.forEach((frequency, n) => {
        const start = Math.round(n * spacing * rate);
        for (let i = 0; i < Math.floor(duration * rate) && start + i < length; i++) {
            const t = i / rate, envelope = Math.min(1, t / .004) * Math.exp(-t / (duration / 5)) * Math.min(1, (duration - t) / .012);
            // Quiet inharmonic partials evoke a small rounded chime rather than a beep.
            data[start + i] += (Math.sin(2 * Math.PI * frequency * t) + .22 * Math.sin(2 * Math.PI * frequency * 2.71 * t) * Math.exp(-t * 35)) * envelope * .48;
        }
    });
    return out;
}
