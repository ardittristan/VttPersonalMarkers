Hooks.once('init', async function () {
    // Init settings
    game.settings.register("personalmarkers", "markerJSON", {
        scope: "client",
        config: false,
        default: {},
        type: Object
    });

    game.settings.register("personalmarkers", "useMiddleMouse", {
        name: game.i18n.localize("PersonalMarkers.useMiddleMouse.name"),
        hint: game.i18n.localize("PersonalMarkers.useMiddleMouse.hint"),
        default: true,
        type: Boolean,
        scope: "client",
        config: true
    });

    game.settings.register("personalmarkers", "keyBind", {
        name: game.i18n.localize("PersonalMarkers.keyBind.name"),
        hint: game.i18n.localize("PersonalMarkers.keyBind.hint"),
        default: "j",
        type: String,
        scope: "client",
        config: true,
        onChange: (newVal) => {
            if (newVal.length > 1) {
                game.settings.set("personalmarkers", "keyBind", newVal.charAt(0));
            }
        }
    });

    game.settings.register("personalmarkers", "deleteOffset", {
        name: game.i18n.localize("PersonalMarkers.deleteOffset.name"),
        hint: game.i18n.localize("PersonalMarkers.deleteOffset.hint"),
        default: 30,
        type: Number,
        scope: "client",
        config: true
    });

    if (typeof window?.Ardittristan?.ColorSetting === "function") {
        new window.Ardittristan.ColorSetting("personalmarkers", "markerIconColor", {
            name: game.i18n.localize("PersonalMarkers.markerIconColor.name"),
            label: game.i18n.localize("PersonalMarkers.markerIconColor.label"),
            defaultColor: "#000000ff",
            scope: "client",
            onChange: () => window.location.reload()
        });
    } else {
        game.settings.register("personalmarkers", "markerIconColor", {
            name: "PersonalMarkers.markerIconColor.name",
            restricted: false,
            default: "#000000ff",
            type: String,
            scope: "client",
            config: true
        });
    }
});

/**
 * Edited version of Pings' PingLayer
 */
class MarkersLayer extends CanvasLayer {
    constructor() {
        super();

        this.pings = {};

        this.globalEventListeners = [
            ['keydown', this._onKeyDown],
            ['pointerdown', this._onMidMouseDown],
        ].map(([e, h]) => {
            return [e, h.bind(this)];
        }).map(([e, h]) => {
            return [
                e,
                (e) => {
                    h(e.originalEvent || e);
                }
            ];
        });

        this.stageListeners = [
            ['mouseover', this._onMouseOver],
            ['mouseout', this._onMouseOut],
        ].map(([e, h]) => {
            return [e, h.bind(this)];
        });
    }

    destroy(options) {
        this._unregisterListeners();

        super.destroy({
            ...options,
            children: true
        });
    }

    /**
     * @private
     */
    _onMouseOver(e) {
        this._mouseOnCanvas = true;
    }

    /**
     * @private
     */
    _onMouseOut(e) {
        this._mouseOnCanvas = false;
    }

    /**
     * @private
     */
    _registerListeners() {
        this.globalEventListeners.forEach((l) => window.addEventListener(...l));
        this._registerStageListeners();
    }

    /**
     * @private
     */
    _registerStageListeners() {
        this.stageListeners.forEach(l => this.parent.on(...l));
    }

    /**
     * @private
     */
    _unregisterListeners() {
        this.globalEventListeners.forEach((l) => window.removeEventListener(...l));
        this.stageListeners.forEach(l => this.parent.off(...l));
    }

    /**
     * @private
     */
    _onMidMouseDown(e) {
        if (!this._mouseOnCanvas || e.button != 1 || !game.settings.get("personalmarkers", "useMiddleMouse")) return;
        e.preventDefault();
        e.stopPropagation();
        const id = Math.random().toString(36).substring(7);
        this._triggerPing(id);
    }

    _onKeyDown(e) {
        if (!this._mouseOnCanvas || e.key != game.settings.get("personalmarkers", "keyBind") || game.settings.get("personalmarkers", "useMiddleMouse")) return;
        const id = Math.random().toString(36).substring(7);
        this._triggerPing(id);
    }

    /**
     * @private
     */
    _triggerPing(id) {
        let position = this._getMousePos();

        var settingsJSON = game.settings.get("personalmarkers", "markerJSON");
        const viewedScene = game.scenes.viewed.id;
        var hasDeleted = false;
        var deleteOffset = game.settings.get("personalmarkers", "deleteOffset");

        for (let value in settingsJSON) {
            let x = settingsJSON[value][0];
            let y = settingsJSON[value][1];
            if (
                (position.x > x - deleteOffset && position.x < x + deleteOffset)
                &&
                (position.y > y - deleteOffset * 1.75 && position.y < y + deleteOffset / 2.5)
            ) {
                if (viewedScene === settingsJSON[value][2]) {
                    this.removePing(value);
                    delete settingsJSON[value];
                    hasDeleted = true;
                }
            }
        }
        if (hasDeleted) {
            game.settings.set("personalmarkers", "markerJSON", settingsJSON);
        } else {
            this.displayPing(position, id, true);
        }
    }

    /**
     * @private
     */
    _getMousePos() {
        const mouse = canvas.app.renderer.plugins.interaction.mouse.global;
        const t = this.worldTransform;

        function calcCoord(axis) {
            return (mouse[axis] - t['t' + axis]) / canvas.stage.scale[axis];
        }

        return {
            x: calcCoord('x'),
            y: calcCoord('y')
        };
    }

    displayPing(position, id, isNew = false) {
        const ping = new Marker(position, id, isNew);

        this.addChild(ping);
    }

    removePing(id) {
        this.children.filter((ping) => ping.id === id).forEach((ping) => ping.destroy());
    }

    addToStage() {
        canvas.pings = canvas.stage.addChild(this);
        this._registerListeners();
        // when canvas is drawn again, the listeners to the stage get cleared, so register them again
        Hooks.on('canvasReady', () => this._registerStageListeners());
    }
}

/**
 * Edited version of Pings' Ping
 */
class Marker extends PIXI.Container {

    constructor(pos, id, isNew = true) {
        super();

        this.x = pos.x;
        this.y = pos.y;

        this.id = id;

        this.pingSize = canvas.scene.data.grid;

        this.ping = this.addChild(this._createMarker());

        if (isNew) {
            this._addToJSON();
        }
    }

    _addToJSON() {
        var markerJSON = game.settings.get("personalmarkers", "markerJSON");
        markerJSON[this.id] = [this.x, this.y, game.scenes.viewed.id];
        game.settings.set("personalmarkers", "markerJSON", markerJSON);
    }

    _createMarker() {
        const ping = PIXI.Sprite.from("modules/personalmarkers/assets/marker.svg");
        const color = game.settings.get("personalmarkers", "markerIconColor").replace("#", "0x").slice(0, -2);
        ping.tint = parseInt(color, 16);
        ping.alpha = 0.8;
        ping.anchor.set(0.5, 1);
        return ping;
    }

    destroy(options) {
        super.destroy({
            ...options,
            children: true
        });
    }
}

Hooks.once("canvasReady", () => {
    const markersLayer = new MarkersLayer();
    markersLayer.addToStage();
    populateCanvas(markersLayer);
    Hooks.on("canvasReady", () => populateCanvas(markersLayer));
});

/**
 * @param  {MarkersLayer} markersLayer
 */
function populateCanvas(markersLayer) {
    console.log("PersonalMarkers || Loading markers");
    var settingsJSON = game.settings.get("personalmarkers", "markerJSON");
    const viewedScene = game.scenes.viewed.id;
    for (let value in settingsJSON) {
        if (settingsJSON[value][2] === viewedScene) {
            markersLayer.displayPing({ x: settingsJSON[value][0], y: settingsJSON[value][1] }, value, false);
        }
    }
}


