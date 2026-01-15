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

Espo.define('esignature:views/fields/esignature', 'views/fields/base', function (Dep) {

    return Dep.extend({
        
        // custom templates
        detailTemplate: 'esignature:fields/esignature/detail',
        editTemplate: 'esignature:fields/esignature/edit',
        listTemplate: 'esignature:fields/esignature/list',

        // custom properties
        blankCanvassCode: '',
        events: {
            'click [data-action="openSignature"]': function (e) {
                e.preventDefault();
                e.stopPropagation();
                this.openEsignatureModal();
            }
        },

        // custom methods        
        init: function () { // overrides "init" function from base.js
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
            var additionaParamList = ['inlineEditDisabled','required'];
            additionaParamList.forEach(function (item) {
                this.params[item] = this.model.getFieldParam(this.name, item) || null;
            }, this);
            this.mode = this.options.mode || this.mode;
            this.template = this.getTemplate();
            console.log('eSignature field mode:', this.mode, 'editTemplate:', this.editTemplate, 'detailTemplate:', this.detailTemplate);
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
            // signature fields can only be edited inline
            //this.listenToOnce(this, 'after:render', this.initInlineEsignatureEdit, this);     
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
        
        data: function () { // overrides "data" function from base.js
            var imageSource = this.getValueForDisplay();
            var data = {
                scope: this.model.name,
                name: this.name,
                defs: this.defs,
                params: this.params,
                value: this.getValueForDisplay(),
                imageSource: imageSource                
            };   
            return data;
        },
        getTemplate: function () {
            if (this.isListMode && this.isListMode() && this.listTemplate) return this.listTemplate;
            if (this.isEditMode && this.isEditMode() && this.editTemplate) return this.editTemplate;
            return this.detailTemplate;
        },

        
        openEsignatureModal: function () {
            if (this.disabled) return;

            // Wenn schon offen: nicht doppelt
            if (this._esignatureView && !this._esignatureView.isRemoved) {
                return;
            }

            this.createView('esignatureModal', 'esignature:views/modals/esignature', {
                model: this.model,
                fieldName: this.name
            }, function (view) {

                this._esignatureView = view;

                // commit => feld setzen + gesamtes formular speichern
                this.listenToOnce(view, 'esignature:commit', function (imageSource, done) {
                    this.model.set(this.name, imageSource);

                    const recordView = this.findRecordEditView_();
                    if (!recordView || typeof recordView.actionSave !== 'function') {
                        done && done(false, 'Konnte Record-Edit-View nicht finden.');
                        return;
                    }

                    const result = recordView.actionSave();

                    if (result && typeof result.then === 'function') {
                        result.then(() => done && done(true))
                            .catch(() => done && done(false, 'Speichern fehlgeschlagen.'));
                    } else {
                        done && done(true);
                    }
                }, this);

                // WICHTIG: nur rendern
                view.render();

            }.bind(this));
        },


        findRecordEditView_: function () {
            // Wir laufen die Parent-Views hoch, bis wir eine View mit actionSave finden.
            let v = this.getParentView && this.getParentView();
            let guard = 0;

            while (v && guard < 10) {
                if (typeof v.actionSave === 'function') {
                    return v;
                }
                v = v.getParentView && v.getParentView();
                guard++;
            }
            return null;
        },


         
    });
});
