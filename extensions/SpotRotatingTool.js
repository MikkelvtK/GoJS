/*
 *  Copyright 1998-2025 by Northwoods Software Corporation. All Rights Reserved.
 */
/*
 * This is an extension and not part of the main GoJS library.
 * The source code for this is at extensionsJSM/SpotRotatingTool.ts.
 * Note that the API for this class may change with any version, even point releases.
 * If you intend to use an extension in production, you should copy the code to your own source directory.
 * Extensions can be found in the GoJS kit under the extensions or extensionsJSM folders.
 * See the Extensions intro page (https://gojs.net/latest/intro/extensions.html) for more information.
 */

/**
 * A custom RotatingTool that also supports the user moving the point about which the object is rotated.
 *
 * Typical usage:
 * ```js
 *   new go.Diagram(. . .,
 *     {
 *       rotatingTool: new SpotRotatingTool(),
 *       . . .
 *     })
 * ```
 *
 * This tool uses two separate Adornments -- the regular one holding the rotation handle and an
 * additional one named "MovingSpot" that holds the handle for interactively moving the
 * {@link go.RotatingTool.rotationPoint} by changing the {@link go.Part.rotationSpot}.
 *
 * If you want to experiment with this extension, try the <a href="../../samples/SpotRotating.html">Spot Rotating</a> sample.
 * @category Tool Extension
 */
class SpotRotatingTool extends go.RotatingTool {
    constructor(init) {
        super();
        this.name = 'SpotRotating';
        this._originalRotationSpot = go.Spot.Default;
        this._spotAdornmentTemplate = new go.Adornment('Spot', { locationSpot: go.Spot.Center, cursor: 'move' }).add(new go.Shape('Circle', { fill: 'lightblue', stroke: 'dodgerblue', width: 10, height: 10 }), new go.Shape('Circle', { fill: 'dodgerblue', strokeWidth: 0, width: 4, height: 4 }));
        if (init)
            Object.assign(this, init);
    }
    /**
     * In addition to updating the standard "Rotating" Adornment, this updates a "MovingSpot"
     * Adornment that the user may drag in order to move the {@link go.RotatingTool.rotationPoint}.
     * @param part
     */
    updateAdornments(part) {
        super.updateAdornments(part);
        if (part === null)
            return;
        if (part.isSelected && !this.diagram.isReadOnly) {
            const rotateObj = part.rotateObject;
            if (rotateObj !== null &&
                part.canRotate() &&
                part.actualBounds.isReal() &&
                part.isVisible() &&
                rotateObj.actualBounds.isReal() &&
                rotateObj.isVisibleObject()) {
                let ad = part.findAdornment('RotateSpot');
                if (ad === null || ad.adornedObject !== rotateObj) {
                    ad = this._spotAdornmentTemplate.copy();
                    ad.adornedObject = part.rotateObject;
                }
                if (ad !== null) {
                    ad.location = this.computeRotationPoint(ad.adornedObject);
                    part.addAdornment('RotateSpot', ad);
                    return;
                }
            }
        }
        part.removeAdornment('RotateSpot');
    }
    /**
     * Change the positioning of the "Rotating" Adornment to adapt to the rotation point
     * potentially being well outside of the object being rotated.
     *
     * This assumes that {@link go.RotatingTool.handleAngle} is zero.
     * @param obj - the object being rotated
     * @returns Point in document coordinates
     */
    computeAdornmentLocation(obj) {
        let p = this.rotationPoint;
        if (!p.isReal())
            p = this.computeRotationPoint(obj);
        const q = obj.getLocalPoint(p);
        //??? ignores this.handleAngle
        q.x = Math.max(obj.naturalBounds.right, q.x) + this.handleDistance;
        return obj.getDocumentPoint(q);
    }
    /**
     * In addition to the standard behavior of {@link go.RotatingTool.canStart},
     * also start when the user starts dragging the "MovingSpot" adornment/handle.
     * @returns boolean
     */
    canStart() {
        if (!this.isEnabled)
            return false;
        const diagram = this.diagram;
        if (diagram.isReadOnly)
            return false;
        if (!diagram.allowRotate)
            return false;
        if (!diagram.lastInput.left)
            return false;
        let h = this.findToolHandleAt(diagram.firstInput.documentPoint, this.name);
        if (h !== null)
            return true;
        h = this.findToolHandleAt(diagram.firstInput.documentPoint, 'RotateSpot');
        return h !== null;
    }
    /**
     * @hidden @internal
     */
    doActivate() {
        // might be dragging the spot handle instead of the rotate handle
        this.handle = this.findToolHandleAt(this.diagram.firstInput.documentPoint, 'RotateSpot');
        if (this.handle !== null) {
            const ad = this.handle.part;
            if (ad.adornedObject !== null) {
                const part = ad.adornedPart;
                if (part !== null)
                    this._originalRotationSpot = part.rotationSpot;
            }
        }
        // doActivate uses this.handle if it is set beforehand, rather than searching for a rotate handle
        super.doActivate();
    }
    /**
     * @hidden @internal
     */
    doCancel() {
        if (this.adornedObject !== null) {
            const part = this.adornedObject.part;
            if (part !== null) {
                part.rotationSpot = this._originalRotationSpot;
                this.rotationPoint.set(this.computeRotationPoint(this.adornedObject));
                this.updateAdornments(part);
            }
        }
        super.doCancel();
    }
    /**
     * @hidden @internal
     */
    doMouseMove() {
        if (this.isActive) {
            if (this.handle !== null && this.handle.part && this.handle.part.category === 'RotateSpot') {
                // modify part.rotationSpot and this.rotationPoint
                this.shiftRotationPoint();
            }
            else {
                super.doMouseMove();
            }
        }
    }
    /**
     * @hidden @internal
     */
    doMouseUp() {
        if (this.isActive) {
            if (this.handle !== null && this.handle.part && this.handle.part.category === 'RotateSpot') {
                // modify part.rotationSpot and this.rotationPoint
                this.shiftRotationPoint();
                this.transactionResult = 'Shifted rotationSpot';
                this.stopTool();
            }
            else {
                super.doMouseUp();
            }
        }
    }
    /**
     * This is called by mouse moves and mouse up events when the handle being dragged is "MovingSpot".
     * This needs to update the {@link go.Part.rotationSpot} and {@link go.RotatingTool.rotationPoint} properties.
     *
     * For each of the X and Y directions, when the handle is within the bounds of the rotated object,
     * the new rotation Spot will be purely fractional; when it is outside the Spot will be limited to
     * a fraction of zero or one (whichever is closer) and an absolute offset that places the rotation point
     * where the handle is.
     * @virtual
     */
    shiftRotationPoint() {
        const dp = this.diagram.lastInput.documentPoint;
        const obj = this.adornedObject;
        if (obj === null)
            return;
        const w = obj.naturalBounds.width || 1; // disallow zero
        const h = obj.naturalBounds.height || 1;
        const part = obj.part;
        if (part === null)
            return;
        const op = obj.getLocalPoint(dp);
        const fx = op.x < 0 ? 0 : op.x > w ? 1 : op.x / w;
        const fy = op.y < 0 ? 0 : op.y > h ? 1 : op.y / h;
        const ox = op.x < 0 ? op.x : op.x > w ? op.x - w : 0;
        const oy = op.y < 0 ? op.y : op.y > h ? op.y - h : 0;
        part.rotationSpot = new go.Spot(fx, fy, ox, oy);
        this.rotationPoint.set(this.computeRotationPoint(obj));
        this.updateAdornments(part);
    }
}
