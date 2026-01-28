<div class="esignature-field">

  {{#if hasSignature}}
    <div class="esignature-preview">
      <canvas class="esignature-preview-canvas" style="border: 1px solid #ddd; display: block;"></canvas>
      <div class="esignature-timestamp" style="color:#666;margin-top:0.5em;font-size:0.9em;font-style:italic;"></div>
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