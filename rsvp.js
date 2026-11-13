(function () {
  'use strict';

  var MAX_PER_GROUP = 50;
  var MAX_LENGTH = 60;
  var NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u;
  var SEND_TIMEOUT_MS = 15000;

  var form = document.getElementById('rsvp-form');
  var submitBtn = document.getElementById('submit-btn');
  var submitLabel = document.getElementById('submit-label');
  var formError = document.getElementById('form-error');
  var success = document.getElementById('success');
  var honeypot = document.getElementById('website');

  var groups = {
    adults: {
      rows: document.getElementById('rows-adults'),
      addBtn: document.getElementById('add-adults'),
      title: 'Erwachsener',
      removeLabel: 'Erwachsenen'
    },
    children: {
      rows: document.getElementById('rows-children'),
      addBtn: document.getElementById('add-children'),
      title: 'Kind',
      removeLabel: 'Kind'
    }
  };

  var uid = 0;
  var sending = false;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { node.appendChild(child); });
    return node;
  }

  function createField(type, kind, label, autocomplete, placeholder, id) {
    var input = el('input', {
      type: 'text',
      id: id,
      name: type + '-' + kind,
      autocomplete: autocomplete,
      maxlength: String(MAX_LENGTH),
      placeholder: placeholder,
      'data-kind': kind,
      'aria-describedby': id + '-err'
    });
    var error = el('p', { id: id + '-err', class: 'field-error', hidden: '' });
    var wrapper = el('div', { class: 'field' }, [
      el('label', { for: id, text: label }),
      input,
      error
    ]);
    return wrapper;
  }

  function createRow(type, isFirst) {
    var n = ++uid;
    var row = el('div', { class: 'name-row', role: 'group', 'data-type': type });
    var title = el('div', { class: 'row-title', id: 'row-title-' + n });
    row.setAttribute('aria-labelledby', 'row-title-' + n);
    if (isFirst) row.setAttribute('data-first', 'true');

    var fields = el('div', { class: 'row-fields' }, [
      createField(type, 'first', 'Vorname', 'given-name', 'Vorname', 'fn-' + n),
      createField(type, 'last', 'Nachname', 'family-name', 'Nachname', 'ln-' + n)
    ]);

    if (!isFirst) {
      var remove = el('button', { type: 'button', class: 'remove-btn' }, [
        el('span', { 'aria-hidden': 'true', text: '×' }),
        el('span', { class: 'rm-text', text: 'Entfernen' })
      ]);
      remove.addEventListener('click', function () { removeRow(type, row); });
      fields.appendChild(remove);
    }

    row.appendChild(title);
    row.appendChild(fields);
    return row;
  }

  function renumber(type) {
    var g = groups[type];
    var rows = g.rows.children;
    Array.prototype.forEach.call(rows, function (row, i) {
      var number = i + 1;
      row.querySelector('.row-title').textContent = g.title + ' ' + number;
      var remove = row.querySelector('.remove-btn');
      if (remove) remove.setAttribute('aria-label', g.removeLabel + ' ' + number + ' entfernen');
    });
    g.addBtn.disabled = rows.length >= MAX_PER_GROUP;
  }

  function addRow(type, focus) {
    var g = groups[type];
    if (g.rows.children.length >= MAX_PER_GROUP) return;
    var row = createRow(type, g.rows.children.length === 0);
    g.rows.appendChild(row);
    renumber(type);
    if (focus) row.querySelector('input').focus();
  }

  function removeRow(type, row) {
    var g = groups[type];
    var index = Array.prototype.indexOf.call(g.rows.children, row);
    row.remove();
    renumber(type);
    // Fokus auf den Hinzufügen-Button oder die vorherige Zeile, damit er nicht verloren geht
    var prev = g.rows.children[Math.max(0, index - 1)];
    var target = prev ? prev.querySelector('.remove-btn, input') : g.addBtn;
    (g.addBtn.disabled ? target : g.addBtn).focus();
  }

  // ---------- Validierung ----------

  function siblingOf(input) {
    var row = input.closest('.name-row');
    var kind = input.getAttribute('data-kind') === 'first' ? 'last' : 'first';
    return row.querySelector('input[data-kind="' + kind + '"]');
  }

  function showError(input, message) {
    var err = document.getElementById(input.id + '-err');
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      err.textContent = message;
      err.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      err.textContent = '';
      err.hidden = true;
    }
  }

  function validateInput(input) {
    var row = input.closest('.name-row');
    var value = input.value.replace(/\s+/g, ' ').trim();
    var sibling = siblingOf(input);
    var required = row.getAttribute('data-first') === 'true' && row.getAttribute('data-type') === 'adults';
    required = required || sibling.value.trim() !== '';
    var isFirstName = input.getAttribute('data-kind') === 'first';
    var message = '';

    if (!value) {
      if (required) message = isFirstName ? 'Bitte gib den Vornamen an.' : 'Bitte gib den Nachnamen an.';
    } else if (value.length > MAX_LENGTH) {
      message = 'Bitte maximal ' + MAX_LENGTH + ' Zeichen.';
    } else if (!NAME_PATTERN.test(value)) {
      message = 'Bitte nur Buchstaben, Leerzeichen, Bindestrich oder Apostroph verwenden.';
    }
    showError(input, message);
    return !message;
  }

  function validateAll() {
    var firstInvalid = null;
    form.querySelectorAll('.name-row input').forEach(function (input) {
      if (!validateInput(input) && !firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
  }

  form.addEventListener('focusout', function (event) {
    if (event.target.matches && event.target.matches('.name-row input')) {
      validateInput(event.target);
      // Das Geschwisterfeld erst prüfen, wenn es schon einmal Fehler zeigte (z. B. nach Absenden)
      var sibling = siblingOf(event.target);
      if (sibling.hasAttribute('aria-invalid')) validateInput(sibling);
    }
  });

  form.addEventListener('input', function (event) {
    var input = event.target;
    if (!input.matches || !input.matches('.name-row input')) return;
    formError.hidden = true;
    if (input.hasAttribute('aria-invalid')) validateInput(input);
    var sibling = siblingOf(input);
    if (sibling.hasAttribute('aria-invalid')) validateInput(sibling);
  });

  // ---------- Senden ----------

  function collect(type) {
    var list = [];
    groups[type].rows.querySelectorAll('.name-row').forEach(function (row) {
      var first = row.querySelector('input[data-kind="first"]').value.replace(/\s+/g, ' ').trim();
      var last = row.querySelector('input[data-kind="last"]').value.replace(/\s+/g, ' ').trim();
      if (first && last) list.push(first + ' ' + last);
    });
    return list;
  }

  function formatList(names) {
    return names.map(function (n) { return '- ' + n; }).join('\n');
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function setSending(state) {
    sending = state;
    submitBtn.disabled = state;
    submitBtn.classList.toggle('loading', state);
    submitBtn.setAttribute('aria-busy', state ? 'true' : 'false');
  }

  function endpoint() {
    var cfg = window.RSVP_CONFIG || {};
    return typeof cfg.formspreeEndpoint === 'string' ? cfg.formspreeEndpoint.trim() : '';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (sending) return;

    formError.hidden = true;

    var invalid = validateAll();
    if (invalid) {
      showFormError('Bitte prüft die markierten Felder.');
      invalid.focus();
      return;
    }

    // Honeypot: Bots bekommen scheinbar Erfolg, es wird nichts gesendet.
    if (honeypot.value.trim() !== '') { showSuccess(); return; }

    var url = endpoint();
    if (!url) {
      showFormError('Das Formular ist noch nicht eingerichtet. Bitte gebt uns anderweitig Bescheid.');
      return;
    }

    var adults = collect('adults');
    var children = collect('children');
    
    var payload = {
      _subject: adults[0],
      Erwachsene: '\n' + formatList(adults),
      Kinder: children.length ? '\n' + formatList(children) : 'Keine Kinder angegeben'
    };

    setSending(true);
    submitLabel.textContent = 'Wird gesendet …';

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, SEND_TIMEOUT_MS);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) throw new Error('status ' + response.status);
      showSuccess();
    }).catch(function () {
      showFormError('Das Senden hat leider nicht geklappt. Bitte prüft eure Internetverbindung und versucht es erneut. Eure Eingaben bleiben erhalten.');
      submitLabel.textContent = 'Erneut versuchen';
      formError.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }).finally(function () {
      clearTimeout(timer);
      setSending(false);
    });
  });

  function showSuccess() {
    form.hidden = true;
    document.querySelector('.intro-block').hidden = true;
    success.hidden = false;
    success.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Start ----------

  Object.keys(groups).forEach(function (type) {
    var g = groups[type];
    addRow(type, false);
    g.addBtn.addEventListener('click', function () { addRow(type, true); });
  });
})();
