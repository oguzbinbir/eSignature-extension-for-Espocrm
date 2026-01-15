Espo.define('esignature:views/modals/esignature', 'views/modal', function (Dep) {

    return Dep.extend({

        template: 'esignature:modals/esignature',

        className: 'dialog dialog-record esignature-sign-modal',

        setup: function () {
            Dep.prototype.setup.call(this);

            this.fieldName = this.options.fieldName;

            this.headerText = this.translate('signHere', 'messages', 'Global') || 'Hier unterschreiben';
            console.log(this.translate('Clear', 'messages', 'Global'));
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

                // Mobile-ähnlich, wenn Touch + (kleine Breite ODER kleine Höhe)
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

                // Fallback
                if (!bodyH) bodyH = (window.visualViewport ? window.visualViewport.height : window.innerHeight) || 500;

                var h;
                if (isFull) {
                    // Fullscreen: so viel wie möglich nutzen (Buttons sind in modal-footer)
                    h = bodyH;
                } else {
                    // Desktop: begrenzen
                    var vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) || 800;
                    var maxH = Math.floor(vh * 0.40);           // 40% viewport
                    h = Math.min(bodyH, Math.max(260, maxH));   // min 260, gedeckelt
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

                    // ✅ Resize + OrientationChange abdecken
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

                    // optional: iOS Safari reagiert oft besser auf visualViewport
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
            const strokes = this.$sig.jSignature('getData', 'native');
            if (!strokes.length) {
                alert(this.translate('noSignatureEntered', 'messages', 'Global'));
                return;
            }

            var d = new Date();
            var timestamp = eSignatureISODateString(d);
            var translatedLabel = this.translate('electronicallySignedOn', 'messages', 'Global');

            var imageSource =
                '<img class="eSignature-img" src="' + this.$sig.jSignature('getData') + '"/>' +
                '<div style="color:black;margin-top:-0.5em;margin-left:0.5em;font-size:1em;font-style:italic;">' +
                translatedLabel + ' ' + timestamp +
                '</div>';

            // done callback: Modal erst schließen, wenn Speichern durch ist
            this.trigger('esignature:commit', imageSource, function (ok, message) {
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
