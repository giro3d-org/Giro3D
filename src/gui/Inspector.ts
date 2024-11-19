import GUI from 'lil-gui';
import { isDisposable } from '../core/Disposable';
import type Instance from '../core/Instance';
import DrawToolPanel from './DrawToolPanel';
import EntityPanel from './EntityPanel';
import InstanceInspector from './InstanceInspector';
import Outliner from './outliner/Outliner';
import PackageInfoInspector from './PackageInfoInspector';
import type Panel from './Panel';
import ProcessingInspector from './ProcessingInspector';
import ViewInspector from './ViewInspector';

// Here follows the style adaptation to lil-gui
const styles = `
.lil-gui .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
}
`;

function visit(root: Element, callbackFn: (element: Element) => void) {
    if (root != null) {
        callbackFn(root);
        if (root.childElementCount > 0) {
            for (const child of root.children) {
                visit(child, callbackFn);
            }
        }
    }
}

const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export interface InspectorOptions {
    /**
     * The panel width, in pixels.
     *
     * @defaultValue 450
     */
    width?: number;
    /**
     * The title of the inspector.
     *
     * @defaultValue Inspector
     */
    title?: string;
}

/**
 * Provides a user interface to inspect and edit the Giro3D scene.
 * The inspector is made of several {@link Panel}.
 * You can implement custom panels and add them to the inspector with
 * {@link Inspector.addPanel}.
 *
 */
class Inspector {
    instance: Instance;
    gui: GUI;
    folders: Panel[];

    /**
     * Creates an instance of the inspector.
     *
     * @param parent - The HTML element to attach the panel to, or the `id` of this element.
     * @param instance - The Giro3D instance.
     * @param options - The options.
     */
    constructor(parent: HTMLElement | string, instance: Instance, options: InspectorOptions = {}) {
        this.instance = instance;
        this.gui = new GUI({
            autoPlace: false,
            width: options.width ?? 450,
            title: options.title ?? 'Inspector',
        });
        this.gui.close();
        this.gui.add(this, 'collapse');

        if (typeof parent === 'string') {
            parent = document.getElementById(parent) as HTMLElement;
        }

        parent.appendChild(this.gui.domElement);

        instance.addEventListener('update-end', () => this.update());

        this.folders = [];

        this.addPanel(new PackageInfoInspector(this.gui, instance));
        this.addPanel(new InstanceInspector(this.gui, instance));
        this.addPanel(new ViewInspector(this.gui, instance));
        this.addPanel(new DrawToolPanel(this.gui, instance));
        this.addPanel(new ProcessingInspector(this.gui, instance));
        this.addPanel(new EntityPanel(this.gui, instance));
        this.addPanel(new Outliner(this.gui, instance));
    }

    collapse() {
        this.folders.forEach(f => f.collapse());
    }

    /**
     * Removes all panel from the inspector.
     *
     */
    clearPanels() {
        while (this.folders.length > 0) {
            const gui = this.folders.pop();
            if (isDisposable(gui)) {
                gui.dispose();
            }
        }
    }

    /**
     * Adds a panel to the inspector.
     *
     * @param panel - The panel to add.
     */
    addPanel(panel: Panel) {
        this.folders.push(panel);
    }

    /**
     * Attaches the inspector to the specified DOM element.
     *
     * @param parent - The element to attach the panel to, or the `id` to the element.
     * @param instance - The Giro3D instance.
     * @param options - The options.
     * @returns The created inspector.
     */
    static attach(
        parent: HTMLElement | string,
        instance: Instance,
        options: InspectorOptions = {},
    ) {
        const inspector = new Inspector(parent, instance, options);
        return inspector;
    }

    /**
     * Detach this Inspector from its instance.
     *
     */
    detach() {
        this.clearPanels();
        this.instance.removeEventListener('update-end', () => this.update());
        this.gui.domElement.remove();
    }

    update() {
        this.folders.forEach(f => f.update());

        // Remove autocomplete on all Input elements to avoid causing issues on some browsers
        // See https://gitlab.com/giro3d/giro3d/-/issues/526
        // Note: we have to do it for each iteration because the content of the inspector can change
        // over time (e.g entities added and removed)
        visit(this.gui.domElement, element => {
            if (element instanceof HTMLInputElement) {
                element.autocomplete = 'off';
            }
        });
    }
}

export default Inspector;
