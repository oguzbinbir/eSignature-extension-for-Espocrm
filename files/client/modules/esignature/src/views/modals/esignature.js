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
            console.log(this);
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

                    this._onResizeEsign = function () {
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
                    };

                    window.addEventListener('resize', this._onResizeEsign);
                    window.addEventListener('orientationchange', this._onResizeEsign);

                    if (window.visualViewport) {
                        window.visualViewport.addEventListener('resize', this._onResizeEsign);
                    }

                }.bind(this));
            }.bind(this));
        },

        actionClear: function () {
            if (this.$sig) this.$sig.jSignature('reset');
        },

        actionSave: function () {
            // Stroke-Daten aus jSignature holen
            const strokes = this.$sig.jSignature('getData', 'native');
            
            if (!strokes || strokes.length === 0) {
                alert(this.translate('noSignatureEntered', 'messages', 'Global'));
                return;
            }

            // Timestamp erstellen
            var d = new Date();
            var timestamp = eSignatureISODateString(d);

            // Canvas-Dimensionen speichern
            var canvas = this.$sig.find('canvas')[0];
            var width = canvas ? canvas.width : 600;
            var height = canvas ? canvas.height : 200;

            // Signature-Daten-Objekt erstellen
            var signatureData = {
                strokes: strokes,
                timestamp: timestamp,
                width: width,
                height: height,
                color: 'rgb(5, 1, 135)',
                lineWidth: 2
            };

            console.log('Saving signature data:', signatureData);

            // Callback: Modal erst schließen, wenn Speichern durch ist
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

            if (typeof this.close === 'function') {
                this.close();
            } else {
                this.remove();
            }
        },
    });
});