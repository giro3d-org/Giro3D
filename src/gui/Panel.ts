/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';
import type { Controller } from 'lil-gui';

import type Instance from '../core/Instance';

export interface TypedController<T> extends Controller {
    initialValue: T | undefined;
    onChange: (callback: (value: T) => void) => this;
    onFinishChange: (callback: (value: T) => void) => this;
    getValue: () => T;
    setValue: (value: T) => this;
}

function parsePascalCase(text: string): string {
    const result: string[] = [text[0].toUpperCase()];

    const SPACE = ' ';

    for (let i = 1; i < text.length; i++) {
        const char = text[i];
        if (char.toUpperCase() === char) {
            result.push(SPACE);
        }
        result.push(char.toLowerCase());
    }

    return result.join('');
}

/**
 * Base class for the panels in the inspector.
 */
abstract class Panel {
    public gui: GUI;
    public instance: Instance;
    /** The controllers. */
    protected _controllers: Controller[];

    public isClosed(): boolean {
        const isGuiClosed = (gui: GUI): boolean => {
            return gui._closed;
        };

        let current = this.gui;

        while (current != null) {
            if (isGuiClosed(current)) {
                return true;
            } else {
                current = current.parent;
            }
        }

        return false;
    }

    /**
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param name - The name of the panel.
     */
    public constructor(parentGui: GUI, instance: Instance, name: string) {
        this.gui = parentGui.addFolder(name);
        this.gui.close();
        this.instance = instance;
        this._controllers = [];
    }

    public notify(source: unknown = undefined): void {
        this.instance.notifyChange(source);
    }

    public collapse(): void {
        this.gui.close();
    }

    /**
     * Adds a color controller to the panel.
     *
     * @param obj - The object.
     * @param prop - The name of the property.
     * @returns The created controller.
     */
    public addColorController<T extends object, K extends keyof T & string>(
        obj: T,
        prop: K,
    ): TypedController<T[K]> {
        const controller = this.gui.addColor(obj, prop) as TypedController<T[K]>;
        this._controllers.push(controller);
        return controller;
    }

    /**
     * Adds a (non-color) controller to the panel.
     * See [the lil-gui API](https://lil-gui.georgealways.com/#GUI#add) for more information.
     *
     * @param obj - The object.
     * @param prop - The name of the property.
     * @param $1 - Minimum value for number controllers,
     * or the set of selectable values for a dropdown.
     * @param max - Maximum value for number controllers.
     * @param step - Step value for number controllers.
     * @returns The created controller.
     */
    public addController<T extends object, K extends keyof T & string>(
        obj: T,
        prop: K,
        $1?: object | number | unknown[],
        max?: number,
        step?: number,
    ): TypedController<T[K]> {
        const controller = this.gui.add(obj, prop, $1, max, step) as TypedController<T[K]>;
        controller.name(parsePascalCase(prop));
        this._controllers.push(controller);
        return controller;
    }

    public removeController(controller: Controller): void {
        this._controllers.slice(this._controllers.indexOf(controller));
        controller.destroy();
        this.updateControllers();
    }

    /**
     * Updates all controllers in this panel with the observed values.
     * This is useful if the value changes from outside the GUI.
     *
     */
    public updateControllers(): void {
        this.updateValues();
        this._controllers.forEach(c => c.updateDisplay());
    }

    /**
     * Updates the values of the controller sources.
     *
     */
    public updateValues(): void {
        /** empty */
    }

    /**
     * Updates the panel. You may override this function if the panel has additional work to do.
     * However, {@link updateControllers} should still be called to ensure they are up to date.
     *
     */
    public update(): void {
        if (!this.isClosed()) {
            this.updateControllers();
        }
    }

    /**
     * Removes this panel from its parent GUI.
     *
     */
    public dispose(): void {
        this.gui.destroy();
    }
}

export default Panel;
