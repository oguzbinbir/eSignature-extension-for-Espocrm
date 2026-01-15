<div class="esignature-field">

  {{#if value}}
    <div class="esignature-preview">
      {{{value}}}
    </div>
  {{else}}
    <div class="esignature-empty text-muted" style="margin-bottom: 8px;">
      {{translate 'signHere' category='messages' scope='Global'}}
    </div>

    <button
      type="button"
      class="btn btn-primary btn-sm"
      data-action="openSignature"
      {{#if disabled}}disabled{{/if}}
    >
      {{translate 'signHere' category='messages' scope='Global'}}
    </button>
  {{/if}}

</div>
