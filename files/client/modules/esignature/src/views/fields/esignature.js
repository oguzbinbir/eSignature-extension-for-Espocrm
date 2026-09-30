/************************************************************************
 * This file is part of EspoCRM.
 *
 * EspoCRM - Open Source CRM application.
 * Copyright (C) 2014-2018 Yuri Kuznetsov, Taras Machyshyn, Oleksiy Avramenko
 * Website: http://www.espocrm.com
 *
 * EspoCRM is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * EspoCRM is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EspoCRM. If not, see http://www.gnu.org/licenses/.
 *
 * The interactive user interfaces in modified source and object code versions
 * of this program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License version 3,
 * these Appropriate Legal Notices must retain the display of the "EspoCRM" word.
 ************************************************************************/

Espo.define('esignature:views/fields/esignature', 'views/fields/base', function (Dep) {

    return Dep.extend({

        // custom templates
        detailTemplate: 'esignature:fields/esignature/detail',
        editTemplate: 'esignature:fields/esignature/edit',
        listTemplate: 'esignature:fields/esignature/list',

        // custom properties
        events: {
            'click [data-action="openSignature"]': function (e) {
                e.preventDefault();
                e.stopPropagation();
                this.openEsignatureModal();
            }
        },

        // custom methods
        init: function () {
            this.events = _.extend({}, this.events || {});

            this.defs = this.options.defs || {};
            this.name = this.options.name || this.defs.name;
            this.params = this.options.params || this.defs.params || {};
            this.fieldType = this.model.getFieldParam(this.name, 'type') || this.type;

            this.getFieldManager().getParamList(this.type).forEach(function (d) {
                var name = d.name;
                if (!(name in this.params)) {
                    this.params[name] = this.model.getFieldParam(this.name, name);
                    if (typeof this.params[name] === 'undefined') {
                        this.params[name] = null;
                    }
                }
            }, this);

            var additionaParamList = ['inlineEditDisabled', 'required'];
            additionaParamList.forEach(function (item) {
                this.params[item] = this.model.getFieldParam(this.name, item) || null;
            }, this);

            this.mode = this.options.mode || this.mode;
            this.template = this.getTemplate();

            this.tooltip = this.options.tooltip || this.params.tooltip || this.model.getFieldParam(this.name, 'tooltip');
            this.disabledLocked = this.options.disabledLocked || false;
            this.disabled = this.disabledLocked || this.options.disabled || this.disabled;

            this.on('invalid', function () {
                var $cell = this.getCellElement();
                $cell.addClass('has-error');
                this.$el.one('click', function () {
                    $cell.removeClass('has-error');
                });
                this.once('render', function () {
                    $cell.removeClass('has-error');
                });
            }, this);

            if ((this.isDetailMode() || this.isEditMode()) && this.tooltip) {
                this.initTooltip();
            }

            this.listenTo(this, 'after:render', function () {
                var isRequired =
                    this.model.getFieldParam(this.name, 'required') ||
                    this.params.required === true;

                var $cell = this.getCellElement && this.getCellElement();
                if (!$cell) return;

                var $labelText = $cell.find('label .label-text');
                if (!$labelText.length) return;

                $labelText.find('.required-sign').remove();

                if (isRequired) {
                    $labelText.append(' <span class="required-sign"> *</span>');
                }
            }, this);

            this.attributeList = this.getAttributeList();

            this.listenTo(this.model, 'change', function (model, options) {
                if (this.isRendered() || this.isBeingRendered()) {
                    if (options.ui) {
                        return;
                    }
                    var changed = false;
                    this.attributeList.forEach(function (attribute) {
                        if (model.hasChanged(attribute)) {
                            changed = true;
                        }
                    });
                    if (changed) {
                        this.reRender();
                    }
                }
            }.bind(this));

            this.listenTo(this, 'change', function () {
                var attributes = this.fetch();
                this.model.set(attributes, { ui: true });
            });
        },

        data: function () {
            var signatureData = this.getSignatureData();
            var hasSignature = false;

            if (signatureData) {
                // Legacy oder neue Strokes
                hasSignature = signatureData.isLegacy ||
                              (signatureData.strokes && signatureData.strokes.length > 0);
            }

            return {
                scope: this.model.name,
                name: this.name,
                defs: this.defs,
                params: this.params,
                value: this.model.get(this.name),
                hasSignature: hasSignature,
                signatureData: signatureData,
                canSign: this.canSign_()
            };
        },

        /**
         * Darf in der aktuellen Ansicht unterschrieben werden?
         * - Edit-Modus: ja (gespeichert wird über "Speichern" des Datensatzes)
         * - Detail-Modus: wie Espo-Inline-Edit -> abhängig von "Inline-Bearbeitung deaktivieren",
         *   Schreibschutz und Bearbeitungsrechten; gespeichert wird sofort
         */
        canSign_: function () {
            if (this.disabled) return false;
            if (this.isEditMode()) return true;

            if (this.params.inlineEditDisabled) return false;
            if (this.readOnly || this.model.getFieldParam(this.name, 'readOnly')) return false;
            if (!this.model.id) return false;

            var acl = this.getAcl();
            if (!acl.checkModel(this.model, 'edit')) return false;
            if (acl.getScopeForbiddenFieldList(this.model.name, 'edit').indexOf(this.name) !== -1) return false;

            return true;
        },

        getTemplate: function () {
            if (this.isListMode && this.isListMode() && this.listTemplate) return this.listTemplate;
            if (this.isEditMode && this.isEditMode() && this.editTemplate) return this.editTemplate;
            return this.detailTemplate;
        },

        /**
         * Parst die gespeicherten Signature-Daten (JSON-String -> Objekt)
         * Abwärtskompatibel: Erkennt auch alte Image-Formate
         */
        getSignatureData: function () {
            var raw = this.model.get(this.name);
            if (!raw) return null;

            // Prüfe ob es alte Image-Daten sind (HTML mit <img>)
            if (typeof raw === 'string' && raw.indexOf('<img') !== -1) {
                // In Listen kürzt EspoCRM lange Texte serverseitig -> vollständig nachladen
                if (!/>\s*$/.test(raw)) {
                    this.loadFullValue_();
                    return null;
                }
                return {
                    isLegacy: true,
                    html: raw
                };
            }

            // Neue Stroke-Daten (JSON)
            try {
                var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (parsed && parsed.strokes) {
                    return {
                        isLegacy: false,
                        ...parsed
                    };
                }
            } catch (e) {
                // Kaputtes JSON = in der Regel vom Server gekürzter Wert (Listenansicht)
                this.loadFullValue_();
            }

            return null;
        },

        /**
         * EspoCRM kürzt Text-Attribute in Listen-Requests (maxSelectTextAttributeLength).
         * Lädt den Datensatz einmalig vollständig nach und rendert das Feld neu.
         */
        loadFullValue_: function () {
            if (this._fullValueRequested || !this.model.id) return;
            this._fullValueRequested = true;

            var url = this.model.name + '/' + this.model.id;
            var request = (typeof Espo.Ajax !== 'undefined')
                ? Espo.Ajax.getRequest(url)
                : this.ajaxGetRequest(url);

            request.then(function (response) {
                if (!response || !(this.name in response)) return;

                this.model.set(this.name, response[this.name], { silent: true });

                if (this.isRendered()) {
                    this.reRender();
                }
            }.bind(this));
        },

        /**
         * Rendert die Signatur-Preview aus Stroke-Daten ODER Legacy-HTML
         */
        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            var signatureData = this.getSignatureData();
            if (!signatureData) return;

            // Legacy-Format: HTML direkt anzeigen
            if (signatureData.isLegacy) {
                this.renderLegacySignature(signatureData.html);
                return;
            }

            // Neues Format: Canvas mit Strokes
            if (signatureData.strokes) {
                this.renderSignaturePreview(signatureData);
            }
        },

        /**
         * Zeigt alte Image-Signaturen an
         */
        renderLegacySignature: function (html) {
            var $container = this.$el.find('.esignature-preview');
            if ($container.length) {
                $container.html(html);
            }
        },

        /**
         * Zeichnet die Signatur-Preview in einen Canvas
         */
        renderSignaturePreview: function (signatureData) {
            var $preview = this.$el.find('.esignature-preview-canvas');
            if (!$preview.length) return;

            var canvas = $preview[0];
            var ctx = canvas.getContext('2d');

            // Canvas-Größe setzen
            var width = signatureData.width || 600;
            var height = signatureData.height || 200;

            // Responsive sizing
            var containerWidth = this.$el.width();
            if (containerWidth && containerWidth < width) {
                var scale = containerWidth / width;
                canvas.width = containerWidth;
                canvas.height = height * scale;
            } else {
                canvas.width = width;
                canvas.height = height;
            }

            // Stroke-Daten zeichnen
            this.drawStrokes(ctx, signatureData.strokes, canvas.width / width);

            // Timestamp anzeigen
            if (signatureData.timestamp) {
                this.renderTimestamp(signatureData.timestamp);
            }
        },

        /**
         * Zeichnet die Strokes auf den Canvas
         */
        drawStrokes: function (ctx, strokes, scale) {
            scale = scale || 1;

            ctx.strokeStyle = '#050187'; // Signature color
            ctx.lineWidth = 2 * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            strokes.forEach(function (stroke) {
                if (!stroke.x || !stroke.y || stroke.x.length === 0) return;

                ctx.beginPath();
                ctx.moveTo(stroke.x[0] * scale, stroke.y[0] * scale);

                for (var i = 1; i < stroke.x.length; i++) {
                    ctx.lineTo(stroke.x[i] * scale, stroke.y[i] * scale);
                }

                ctx.stroke();
            });
        },

        /**
         * Zeigt den Timestamp an
         */
        renderTimestamp: function (timestamp) {
            var $timestamp = this.$el.find('.esignature-timestamp');
            if ($timestamp.length) {
                var translatedLabel = this.translate('electronicallySignedOn', 'messages', 'Global');
                $timestamp.text(translatedLabel + ' ' + timestamp);
            }
        },

        openEsignatureModal: function () {
            if (!this.canSign_()) return;

            this.createView(
                'esignatureModal',
                'esignature:views/modals/esignature',
                {
                    model: this.model,
                    fieldName: this.name
                },
                function (view) {
                    view.render();

                    // Commit: Signatur setzen (Edit-Modus) bzw. direkt speichern (Detail-Modus)
                    this.listenTo(view, 'esignature:commit', function (signatureData, done) {
                        var value = JSON.stringify(signatureData);

                        if (this.isEditMode()) {
                            // Gespeichert wird später über "Speichern" des Datensatzes
                            this.model.set(this.name, value);
                            done && done(true);
                            this.lockOtherFields_(this);
                            return;
                        }

                        this.saveSignature_(value, done);
                    }, this);
                },
                this
            );
        },

        /**
         * Detail-Modus: nur das Signaturfeld sofort speichern (wie Espo-Inline-Edit)
         */
        saveSignature_: function (value, done) {
            var previousValue = this.model.get(this.name);
            var attributes = {};
            attributes[this.name] = value;

            this.notify('Saving...');

            this.model.save(attributes, { patch: true }).then(
                function () {
                    this.notify('Saved', 'success');
                    done && done(true);
                }.bind(this),
                function () {
                    this.notify(false);
                    this.model.set(this.name, previousValue);
                    done && done(false, this.translate('Error'));
                }.bind(this)
            );
        },

        lockOtherFields_: function (ctx) {
            const $form = ctx.$el.closest('.record, .edit, .detail, form');
            if (!$form.length) return;

            $form.find('input, select, textarea, button').each(function () {
                const $el = $(this);
                // - Action-Buttons (z. B. Speichern/Abbrechen)
                if ($el.closest(ctx.$el).length) return;
                if ($el.hasClass('action')) return;
                $el.attr('disabled', 'disabled');
            });
        },

        /**
         * Validation: required Signatur muss vorhanden sein
         * - Prüft gespeicherten Wert (JSON / Legacy)
         * - Optional: falls im Edit-Mode ein Signature-Pad existiert, prüft Strokes
         *
         * Rückgabe:
         * - true  => Fehler (blockiert Speichern)
         * - false => ok
         */
        validate: function () {
            var isRequired =
                this.model.getFieldParam(this.name, 'required') ||
                this.params.required === true;

            if (!isRequired) return false;

            // 1) Bereits gespeicherter Wert?
            var raw = this.model.get(this.name);
            var hasSavedValue = !!raw;

            // Legacy (<img ...>) zählt als vorhanden
            if (hasSavedValue && typeof raw === 'string' && raw.indexOf('<img') !== -1) {
                return false;
            }

            // JSON-Strokes zählen als vorhanden
            if (hasSavedValue) {
                try {
                    var parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
                    if (parsed && parsed.strokes && parsed.strokes.length > 0) {
                        return false;
                    }
                } catch (e) {
                    // wenn kaputtes JSON, dann nicht als gültig werten
                }
            }

            // 2) Optional: Wenn im Edit-Mode irgendwo ein aktives jSignature-Pad hängt
            // (z.B. wenn du es inline rendern würdest). In deinem aktuellen Flow ist
            // die Signatur im Modal, daher kann dieser Teil meist false bleiben.
            var hasStrokes = false;
            try {
                if (this.isEditMode && this.isEditMode()) {
                    // Suche nach jSignature-Canvas innerhalb des Feldes
                    var $canvas = this.$el.find('canvas.jSignature');
                    if ($canvas.length) {
                        var $pad = $canvas.closest('[data-signature-pad], .jSignature, .esignature-pad, .signature-pad').first();
                        if ($pad.length && typeof $pad.jSignature === 'function') {
                            var strokes = $pad.jSignature('getData', 'native') || [];
                            hasStrokes = strokes && strokes.length > 0;
                        }
                    }
                }
            } catch (e) {}

            if (!hasSavedValue && !hasStrokes) {
                var label =
                    (this.getLanguage && this.getLanguage().translate(this.name, 'fields', this.model.name)) ||
                    this.params.label || this.name;

                var msg =
                    (this.getLanguage && this.getLanguage().translate('fieldIsRequired', 'messages', 'Global')) ||
                    '{field} wird benötigt';

                msg = msg.replace(/\{field\}/g, label);

                this.showValidationMessage(msg);
                return true; // blockiert Speichern
            }

            return false;
        }

    });
});
