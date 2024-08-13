/**
 * The data source for a [Potree](https://github.com/potree/potree) point cloud.
 */
class PotreeSource {
    readonly isPotreeSource = true as const;
    readonly type = 'PotreeSource' as const;
    readonly url: string;
    readonly filename: string;
    readonly networkOptions: object;

    /**
     * Creates an instance of PotreeSource.
     *
     * @param url - The URL to the dataset.
     * @param filename - The filename of the dataset.
     * @param networkOptions - The network options.
     */
    constructor(url: string, filename = 'cloud.js', networkOptions: object = {}) {
        if (!url) {
            throw new Error('missing url parameter');
        }

        this.url = url;
        this.filename = filename;
        this.networkOptions = networkOptions || {};
    }
}

export default PotreeSource;
