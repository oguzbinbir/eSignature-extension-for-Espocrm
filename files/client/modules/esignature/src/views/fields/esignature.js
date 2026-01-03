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
/** @preserve
jSignature v2 "${buildDate}" "${commitID}"
Copyright (c) 2012 Willow Systems Corp http://willow-systems.com
Copyright (c) 2010 Brinley Ang http://www.unbolt.net
MIT License <http://www.opensource.org/licenses/mit-license.php>
*/

console.log('[DEBUG eSignature] loaded module esignature:views/fields/esignature');


Espo.define('esignature:views/fields/esignature', 'views/fields/base', function (Dep) {

    return Dep.extend({
        
        // custom templates
        detailTemplate: 'esignature:fields/esignature/detail',
        editTemplate: 'esignature:fields/esignature/edit',
        listTemplate: 'esignature:fields/esignature/list',

        // custom properties
        blankCanvassCode: '',
        
        // custom methods        
        init: function () { // overrides "init" function from base.js
            console.log("init:");
            if (this.events) {
                this.events = _.clone(this.events);
            } else {
                this.events = {};
            }
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
            var additionalParamList = ['inlineEditDisabled','required'];
            additionalParamList.forEach(function (item) {
                this.params[item] = this.model.getFieldParam(this.name, item) || null;
            }, this);
            this.mode = this.options.mode || this.mode;
            console.log("Debug 1");
            console.log(this.mode);
            if (this.isDetailMode && this.isDetailMode()) {
                this.template = this.detailTemplate;
            }
            this.template = this.getTemplate();
            console.log(this.template);
            this.tooltip = this.options.tooltip || this.params.tooltip || this.model.getFieldParam(this.name, 'tooltip');
            this.disabledLocked = this.options.disabledLocked || false;
            this.disabled = this.disabledLocked || this.options.disabled || this.disabled;
            // signature fields can only be seen in detail mode
            //this.setMode('detail');
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
            // Nur im Detail-Modus Inline-Edit (Stift) aktivieren:
            if (this.isDetailMode && this.isDetailMode()) {
                this.listenToOnce(this, 'after:render', this.initInlineEsignatureEdit, this);
            }

            // Nur im Edit-/Create-Modus den Canvas direkt initialisieren:
            if (this.isEditMode && this.isEditMode()) {
                this.listenToOnce(this, 'after:render', this.initSignatureInEdit, this);
            }  

            this.listenTo(this, 'after:render', function () {
                var isRequired =
                    this.model.getFieldParam(this.name, 'required') ||
                    this.params.required === true;

                var $cell = this.getCellElement && this.getCellElement();
                if (!$cell) return;

                // Label-Text finden (Struktur: <label> <span class="label-text">…</span> …)
                var $labelText = $cell.find('label .label-text');
                if (!$labelText.length) return;

                // Erst entfernen, dann ggf. neu anhängen (verhindert Duplikate nach Re-Render)
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
                this.model.set(attributes, {ui: true});
            });
        },

        getTemplate: function () {
            console.log("Get template aufgerufen");
            if (this.isListMode() && this.listTemplate) return this.listTemplate;
            if (this.isEditMode() && this.editTemplate) return this.editTemplate;
            return this.detailTemplate;
        },


        
        data: function () { // overrides "data" function from base.js
            console.log("data:");
            var imageSource = this.getValueForDisplay();
            var data = {
                scope: this.model.name,
                name: this.name,
                defs: this.defs,
                params: this.params,
                value: this.getValueForDisplay(),
                imageSource: imageSource                
            };   
            // signature fields can not be edited manually, force detail mode
            /*if(this.mode !== "detail") {
                this.setMode("detail");
            }*/
            console.log("Debug 2");
            console.log(this.mode);
            return data;
        },

        initInlineEsignatureEdit: function () { // custom function equivalent to "initInlineEdit" at base.js   
            console.log("initInlineEsignatureEdit:");
            var $cell = this.getCellElement();
            var $editLink = $(
                '<button type="button" class="pull-right inline-edit-link hidden" aria-label="Edit" style="background-color:unset;border:unset;">' +
                    '<span class="fas fa-pencil-alt fa-sm"></span>' +
                '</button>'
                );
            console.log($cell.length);
            console.log(this.model.get(this.name));
            if ($cell.length === 0 || typeof(this.model.get(this.name))=== 'undefined') {
                console.log("erneute prüfung");
                this.listenToOnce(this, 'after:render', this.initInlineEsignatureEdit, this);
                return;
            }
            // if the signature field already has a value do not add the inline edit link and set the field as readonly
            console.log(this.model.get(this.name));
            if(this.model.get(this.name)) {
                console.log("readonly");
                this.readOnly = true;
                return;                
            }
            // after the element has been rendered, add the hidden pencil icon link
            $cell.prepend($editLink);
            $editLink.on('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                // when clicked, call the custom signature field inline edit function
                this.inlineEsignatureEdit(); 
            // bind the functionality to the pencil icon link    
            }.bind(this));
            $cell.on('mouseenter', function (e) {
                e.stopPropagation();
                if (this.disabled || this.readOnly || this._isInlineEditMode) {
                        return;
                }
                if (this.mode === 'detail') {
                    $editLink.removeClass('hidden');
                }
            }.bind(this)).on('mouseleave', function (e) {
                e.stopPropagation();
                if (this.mode === 'detail') {
                    $editLink.addClass('hidden');
                }
            }.bind(this));
        },

        inlineEsignatureEdit: function() { // custom function equivalent to "inlineEdit" at base.js    
            console.log("inlineEsignatureEdit:"); 
            this._isInlineEditMode = true;       
            // add css class esignature to the field element
            this.$el.addClass('eSignature');
            // initialize jSignature plug-in to display canvas input
            var $sigDiv = this.$el.jSignature({
                UndoButton: true,
                color: 'rgb(5, 1, 135)',
                SignHere: {
                    renderer: function () {
                    // eigenes Hinweis-Element zurückgeben
                    const label = this.translate('signHere', 'messages', 'Global');

                    const $badge = $('<div/>', {
                        class: 'jsign-signhere-badge',
                        text: label
                        });
                    return $badge;
                    }.bind(this) // bind, damit this.translate() funktioniert
                }
                });
            // get the blank canvass code value to compare against a filled canvas
            this.blankCanvassCode = $sigDiv.jSignature('getData');
            // add the inline action links ("Update" and "Cancel")
            this.addInlineEditLinks(); // function inherited from base.js               
        },

        initSignatureInEdit: function () {
            var raw = this.model.get(this.name);
            var hasValue = raw !== null && raw !== undefined && raw !== '';
            if (hasValue) {
                this.readOnly = true;
                return;
            }

            var $host = this.$el.addClass('eSignature');

            if (typeof $host.jSignature === 'function') {
                $host.jSignature({
                    UndoButton: true,
                    color: 'rgb(5, 1, 135)',
                    SignHere: { renderer: function () {
                        const label = this.translate('signHere', 'messages', 'Global');
                        return $('<div/>', { class: 'jsign-signhere-badge', text: label });
                    }.bind(this) }
                });
            
                let hasLocked = false;
                const lockedNames = new Set();
                const hadSavedValueAtStart = !!this.model.get(this.name);

                function getRecordViewWithGetFieldView(ctx) {
                let v = ctx, i = 0;
                while (v && i < 12) {
                    v = (v.getParentView && v.getParentView()) || null;
                    if (v && typeof v.getFieldView === 'function') return v;
                    i++;
                }
                return null;
                }
                //------

                function toggleInputsDisabled(ctx, disabled) {
                    const $form = ctx.$el.closest('.record, .edit, .detail, form');
                    if (!$form.length) return;

                    $form.find('input, select, textarea, button').each(function () {
                        const $el = $(this);

                        // - Signaturfeld selbst
                        // - Action-Buttons (z. B. Speichern/Abbrechen)
                        if ($el.closest(ctx.$el).length) return;
                        if ($el.hasClass('action')) return;

                        if (disabled) {
                            $el.attr('disabled', 'disabled');
                        } else {
                            $el.removeAttr('disabled');
                        }
                    });
                }

                // ------------------------------
                // Reagiere auf Signaturänderungen
                // ------------------------------
                let locked = false;
                const hadSavedValue = !!this.model.get(this.name);

                $host.on('change', function () {
                    this.trigger('change'); // hält Model in Sync

                    const strokes = (typeof $host.jSignature === 'function')
                        ? ($host.jSignature('getData', 'native') || [])
                        : [];

                    if (!locked && strokes.length > 0 && !hadSavedValue) {
                        toggleInputsDisabled(this, true);
                        locked = true;
                    }

                    if (locked && strokes.length === 0 && !hadSavedValue) {
                        toggleInputsDisabled(this, false);
                        locked = false;
                    }
                }.bind(this));
            }
        },


        
        inlineEditClose: function () { // substitutes same function at base.js
            console.log("inlineEditClose:");
            this.trigger('inline-edit-off');
            this._isInlineEditMode = false;
            this.once('after:render', function () {
                // remove the inline edit links
                this.removeInlineEditLinks(); // function inherited from base.js
            }, this);
            // re-renders the entity in detail mode
            this.reRender(true);
        },
        
        inlineEditSave: function () { // substitutes same function at base.js   
            console.log("inlineEditSave:");
            // compare the amount of strokes to make sure there's a signature to be saved
            const strokes = this.$el.jSignature('getData', 'native');
            if (!strokes.length) {
                alert(this.translate('noSignatureEntered', 'messages', 'Global'));
                return;
            }

            // register the signature time stamp
            var d = new Date();
            var timestamp = eSignatureISODateString(d);             
            // prepare the signature drawing to be stored in the database integrating the timestamp
            var translatedLabel = this.translate('electronicallySignedOn', 'messages', 'Global');
            var imageSource = '<img class="eSignature-img" src="' + this.$el.jSignature('getData') + '"/>' +
                            '<div style="color:black;margin-top:-0.5em;margin-left:0.5em;font-size:1em;font-style:italic;">' +
                            translatedLabel + ' ' + timestamp +
                            '</div>';

            this.notify('Saving...');
            var self = this;
            var model = this.model;
            var prev = this.initialAttributes;
            var data = model.attributes;
            // store the image code as the field value
            data[this.name] = imageSource;
            // persist the model with the updated field value
            this.model.save(data, {
                success: function () {
                    self.trigger('after:save');
                    model.trigger('after:save');
                    self.notify('Saved', 'success');
                },
                error: function () {
                    alert("Error in saving to DB");
                    self.notify('Error occured', 'error');
                    // undo all field value changes
                    model.set(prev, {silent: true});
                    // re-render with the original values
                    self.render();
                },
                patch: true
            });
            // set field as readonly
            this.readOnly = true;
            this.inlineEditClose();
        },
        fetch: function () {
            console.log("fetch:");
            var out = {};
            // Standard: bestehenden Wert behalten
            var current = this.model.get(this.name) || null;

            if (this.isEditMode && this.isEditMode() && typeof this.$el.jSignature === 'function') {
                // Hat der Nutzer gezeichnet?
                var strokes = this.$el.jSignature('getData', 'native') || [];
                if (strokes.length) {
                    var imgData = this.$el.jSignature('getData'); // data URI
                    var ts = eSignatureISODateString(new Date());
                    var label = this.translate('electronicallySignedOn', 'messages', 'Global');
                    current = '<img class="eSignature-img" src="' + imgData + '"/>' +
                            '<div style="color:black;margin-top:-0.5em;margin-left:0.5em;font-size:1em;font-style:italic;">' +
                            label + ' ' + ts +
                            '</div>';
                }
                // sonst: nichts gezeichnet -> bisherigen Wert nicht löschen
            }

            out[this.name] = current;
            return out;
        },

        validate: function () {
            // required-Flag wie gehabt lesen
            var isRequired =
                this.model.getFieldParam(this.name, 'required') ||
                this.params.required === true;

            if (!isRequired) return false;

            var hasSavedValue = !!this.model.get(this.name);
            var hasStrokes = false;

            if (this.isEditMode && this.isEditMode() && typeof this.$el.jSignature === 'function') {
                var strokes = this.$el.jSignature('getData', 'native') || [];
                hasStrokes = strokes.length > 0;
            }

            if (!hasSavedValue && !hasStrokes) {
                var label =
                (this.getLanguage && this.getLanguage().translate(this.name, 'fields', this.model.name)) ||
                this.params.label || this.name;

                var msg = (this.getLanguage && this.getLanguage().translate('fieldIsRequired', 'messages', 'Global')) ||
                        '{field} wird benötigt';
                msg = msg.replace(/\{field\}/g, label);

                this.showValidationMessage(msg);
                return true; // blockiert Speichern
            }
            return false;
        }



    });
});
