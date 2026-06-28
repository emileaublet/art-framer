interface AiProvider {
    prePass(artwork: Buffer, sceneHint: string): Promise<Buffer>;
    postPass(composite: Buffer, sceneHint: string): Promise<Buffer>;
}
type FrameName = 'thin-black' | 'classic-wood' | 'ornate-gold';
interface FrameOptions {
    frame: FrameName;
    provider: AiProvider;
    output: string;
}
type Quad = [
    [
        number,
        number
    ],
    [
        number,
        number
    ],
    [
        number,
        number
    ],
    [
        number,
        number
    ]
];
interface SceneConfig {
    quad: Quad;
    ambientLight: string;
    hint: string;
}
declare class CompositorError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
declare class ProviderError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
declare class TemplateNotFoundError extends Error {
    constructor(frame: string);
}

declare function frameArtwork(artworkPath: string, options: FrameOptions): Promise<void>;

export { type AiProvider, CompositorError, type FrameName, type FrameOptions, ProviderError, type Quad, type SceneConfig, TemplateNotFoundError, frameArtwork };
