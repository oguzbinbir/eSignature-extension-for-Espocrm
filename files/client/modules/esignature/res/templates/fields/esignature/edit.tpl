<div class="esignature-field">
  {{#if value}}
    <div class="esignature-preview">
      {{{value}}}
    </div>
  {{else}}
    <button type="button" class="btn btn-primary btn-sm" data-action="openSignature">
      Hier unterschreiben
    </button>
  {{/if}}
</div>
