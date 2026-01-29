Espo.define('esignature:views/modals/esignature', 'views/modal', function (Dep) {

    return Dep.extend({

        template: 'esignature:modals/esignature',

        className: 'dialog dialog-record esignature-sign-modal',

        setup: function () {
            Dep.prototype.setup.call(this);

            this.fieldName = this.options.fieldName;

            this.headerText = this.translate('signHere', 'messages', 'Global') || 'Hier unterschreiben';

            this.buttonList = [
                {name: 'save', label: this.translate('Save') || 'Speichern', style: 'primary'},
                {name: 'clear', label: this.translate('clear', 'messages', 'Global') || 'Löschen'},
                {name: 'cancel', label: this.translate('Cancel') || 'Abbrechen'}
            ];
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            var $sig = this.$el.find('[data-signature-pad]');

            var isMobileLike = function () {
                var vv = window.visualViewport;
                var w = vv ? vv.width : window.innerWidth;
                var h = vv ? vv.height : window.innerHeight;

                var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

                return hasTouch && (w < 900 || h < 500);
            };

            // Variante 2: Fit + Center (keine Verzerrung)
            function fitStrokesToCanvas(strokes, newW, newH, padding) {
                padding = (typeof padding === 'number') ? padding : 14;

                if (!strokes || !strokes.length || !newW || !newH) return strokes;

                var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                for (var i = 0; i < strokes.length; i++) {
                    var s = strokes[i];
                    if (!s || !s.x || !s.y) continue;

                    for (var j = 0; j < s.x.length; j++) {
                        var x = s.x[j];
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                    }
                    for (var k = 0; k < s.y.length; k++) {
                        var y = s.y[k];
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }

                if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return strokes;

                var sigW = Math.max(1, (maxX - minX));
                var sigH = Math.max(1, (maxY - minY));

                var availW = Math.max(1, (newW - 2 * padding));
                var availH = Math.max(1, (newH - 2 * padding));

                // uniform scale (keine Verzerrung)
                var sFactor = Math.min(availW / sigW, availH / sigH);

                // Zentrieren
                var offsetX = (newW - sigW * sFactor) / 2 - minX * sFactor;
                var offsetY = (newH - sigH * sFactor) / 2 - minY * sFactor;

                var out = [];
                for (i = 0; i < strokes.length; i++) {
                    var st = strokes[i];
                    var nx = new Array(st.x.length);
                    var ny = new Array(st.y.length);

                    for (j = 0; j < st.x.length; j++) nx[j] = st.x[j] * sFactor + offsetX;
                    for (k = 0; k < st.y.length; k++) ny[k] = st.y[k] * sFactor + offsetY;

                    out.push({ x: nx, y: ny });
                }

                return out;
            }

            var setPadHeight = function () {
                var isFull = isMobileLike();
                this.$el
                    .addClass('esignature-sign-modal')
                    .toggleClass('is-full', isFull)
                    .toggleClass('is-desktop', !isFull);

                var $body = this.$el.closest('.modal-body');
                var bodyH = $body.length ? $body.height() : this.$el.height();

                if (!bodyH) bodyH = (window.visualViewport ? window.visualViewport.height : window.innerHeight) || 500;

                var h;
                if (isFull) {
                    h = bodyH;
                } else {
                    var vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) || 800;
                    var maxH = Math.floor(vh * 0.40);
                    h = Math.min(bodyH, Math.max(260, maxH));
                }

                $sig.css({
                    width: '100%',
                    height: h + 'px',
                    minHeight: '260px'
                });
            }.bind(this);

            // Loop-/Sturm-Schutz
            this._esignResizing = false;
            this._esignResizeTimer = null;

            requestAnimationFrame(function () {
                requestAnimationFrame(function () {

                    setPadHeight();

                    try { $sig.jSignature('destroy'); } catch (e) {}
                    $sig.empty();

                    $sig.jSignature({
                        width: '100%',
                        height: '100%',
                        UndoButton: false,
                        color: 'rgb(5, 1, 135)',
                        SignHere: { renderer: function () { return $(); } }
                    });

                    this.$sig = $sig;

                    var rebuildWithFit = function () {
                        if (this._esignResizing) return;
                        this._esignResizing = true;

                        // Debounce (mobile resize kann häufig feuern)
                        clearTimeout(this._esignResizeTimer);
                        this._esignResizeTimer = setTimeout(function () {

                            var strokes = null;
                            try { strokes = $sig.jSignature('getData', 'native'); } catch (e) {}

                            // erst Layout setzen, dann im nächsten Frame Canvas neu bauen und Maße lesen
                            setPadHeight();

                            requestAnimationFrame(function () {
                                // altes Canvas war schon da; wir bauen neu
                                try { $sig.jSignature('destroy'); } catch (e) {}
                                $sig.empty();

                                $sig.jSignature({
                                    width: '100%',
                                    height: '100%',
                                    UndoButton: false,
                                    color: 'rgb(5, 1, 135)',
                                    SignHere: { renderer: function () { return $(); } }
                                });

                                var canvas = $sig.find('canvas')[0];
                                var newW = canvas ? canvas.width : 0;
                                var newH = canvas ? canvas.height : 0;

                                if (strokes && strokes.length && newW && newH) {
                                    var fitted = fitStrokesToCanvas(strokes, newW, newH, 14);
                                    // explizit als native setzen
                                    try { $sig.jSignature('setData', fitted, 'native'); } catch (e) {}
                                }

                                // Guard lösen
                                this._esignResizing = false;

                            }.bind(this));

                        }.bind(this), 120);

                    }.bind(this);

                    this._onResizeEsign = rebuildWithFit;

                    // Empfehlung: Desktop resize ok; Mobile besser orientationchange.
                    // Du kannst beides aktivieren; durch Debounce+Guard ist es stabil.
                    window.addEventListener('resize', this._onResizeEsign);
                    window.addEventListener('orientationchange', this._onResizeEsign);

                    // Wenn du visualViewport bisher Probleme hattest: lieber AUS lassen.
                    // Wenn du es wirklich brauchst, dann nur mit debounce+guard:
                    // if (window.visualViewport) window.visualViewport.addEventListener('resize', this._onResizeEsign);

                }.bind(this));
            }.bind(this));
        },

        actionClear: function () {
            if (this.$sig) this.$sig.jSignature('reset');
        },

        actionSave: function () {
            const strokes = this.$sig.jSignature('getData', 'native');

            if (!strokes || strokes.length === 0) {
                alert(this.translate('noSignatureEntered', 'messages', 'Global'));
                return;
            }

            var d = new Date();
            var timestamp = eSignatureISODateString(d);

            var canvas = this.$sig.find('canvas')[0];
            var width = canvas ? canvas.width : 600;
            var height = canvas ? canvas.height : 200;

            var signatureData = {
                strokes: strokes,
                timestamp: timestamp,
                width: width,
                height: height,
                color: 'rgb(5, 1, 135)',
                lineWidth: 2
            };

            console.log('Saving signature data:', signatureData);

            this.trigger('esignature:commit', signatureData, function (ok, message) {
                if (ok) {
                    this.closeSafe_();
                } else {
                    if (message) alert(message);
                }
            }.bind(this));
        },

        closeSafe_: function () {
            try {
                if (this.$sig && typeof this.$sig.jSignature === 'function') {
                    this.$sig.jSignature('destroy');
                }
            } catch (e) {}

            if (this._onResizeEsign) {
                window.removeEventListener('resize', this._onResizeEsign);
                window.removeEventListener('orientationchange', this._onResizeEsign);
                if (window.visualViewport) {
                    window.visualViewport.removeEventListener('resize', this._onResizeEsign);
                }
                this._onResizeEsign = null;
            }

            if (this._esignResizeTimer) {
                clearTimeout(this._esignResizeTimer);
                this._esignResizeTimer = null;
            }

            this._esignResizing = false;

            if (typeof this.close === 'function') {
                this.close();
            } else {
                this.remove();
            }
        },
    });
});
