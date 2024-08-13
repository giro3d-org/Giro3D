/**
 * The source to feed a `Tiles3D` entity.
 */
class Tiles3DSource {
    readonly isTiles3DSource: boolean = true;
    readonly type: string = 'Tiles3DSource';
    readonly url: string;
    readonly networkOptions: RequestInit | undefined;

    /**
     * @param url - The URL to the root tileset.
     * @param networkOptions - the network options.
     */
    constructor(url: string, networkOptions?: RequestInit) {
        this.url = url;
        this.networkOptions = networkOptions;
    }
}

export default Tiles3DSource;
