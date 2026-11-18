import { api, auth } from '../api.js';
import { $, esc, badge, formatDateTime, toast, loading } from '../ui.js';

export async function renderSurveys(container) {
  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();

  container.innerHTML = `
    <!-- Surveys Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); gap: 16px; flex-wrap: wrap;">
      <div>
        <span class="caption" style="color: var(--primary);">Community Input</span>
        <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">Surveys & Questionnaires</h1>
        <p class="text-muted" style="max-width: 680px; margin: 0;">
          Participate in university surveys, curriculum evaluations, and alumni mentorship programs.
        </p>
      </div>
    </div>

    <div id="surveys-list"></div>
    <div id="survey-modal-container"></div>
  `;

  async function loadData() {
    const listEl = container.querySelector('#surveys-list');
    listEl.innerHTML = loading('Loading active surveys...');

    try {
      const res = await api.getPage('/surveys');
      renderList(res.data || [], listEl);
    } catch (err) {
      listEl.innerHTML = `<div class="card" style="color:var(--danger); text-align:center; padding:32px;">Failed to load surveys: ${esc(err.message)}</div>`;
    }
  }

  function renderList(surveys, el) {
    if (!surveys.length) {
      el.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="font-size: 32px; margin-bottom: 12px;">📋</div>
          <h3 style="margin-bottom: 6px;">No active surveys</h3>
          <p class="small muted" style="margin: 0;">There are currently no active community questionnaires.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="grid grid-2">
        ${surveys.map(s => `
          <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span class="badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}">${esc(s.status)}</span>
                ${s.hasResponded ? `<span class="badge badge-info">✓ Completed</span>` : `<span class="small muted">${s.questionCount} Questions</span>`}
              </div>
              <h3 style="font-size: 18px; margin-bottom: 8px;">${esc(s.title)}</h3>
              <p class="text-muted small" style="line-height:1.5; margin-bottom:16px;">
                ${esc(s.description || 'Community questionnaire for feedback and insights.')}
              </p>
            </div>

            <div style="padding-top:16px; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
              <span class="small muted">Responses: <strong>${s.responseCount}</strong></span>
              ${
                s.hasResponded
                  ? `<button class="btn btn-sm btn-secondary view-resp-btn" data-id="${s.surveyId}">View Your Answers</button>`
                  : `<button class="btn btn-sm btn-primary take-survey-btn" data-id="${s.surveyId}" ${!isAuth ? 'disabled' : ''}>
                      ${isAuth ? 'Take Survey →' : 'Sign in to Participate'}
                    </button>`
              }
            </div>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('.take-survey-btn').forEach(btn => {
      btn.addEventListener('click', () => openTakeSurveyModal(btn.dataset.id));
    });

    el.querySelectorAll('.view-resp-btn').forEach(btn => {
      btn.addEventListener('click', () => openViewResponseModal(btn.dataset.id));
    });
  }

  async function openTakeSurveyModal(surveyId) {
    const modalEl = container.querySelector('#survey-modal-container');
    modalEl.innerHTML = loading('Loading survey questions...');

    try {
      const res = await api.get(`/surveys/${surveyId}`);
      const survey = res.data || res;

      modalEl.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" style="max-width: 680px; max-height: 85vh; overflow-y: auto;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
              <div>
                <span class="caption" style="color:var(--primary);">Active Questionnaire</span>
                <h2 style="font-size: 20px; font-weight: 700; margin: 4px 0 0;">${esc(survey.title)}</h2>
              </div>
              <button id="close-take-survey" class="btn btn-ghost btn-sm" style="font-size:18px;">✕</button>
            </div>

            ${survey.description ? `<p class="small text-muted" style="margin-bottom: 20px;">${esc(survey.description)}</p>` : ''}

            <form id="survey-response-form" style="display:flex; flex-direction:column; gap:20px;">
              ${survey.questions.map((q, idx) => `
                <div class="field" style="margin: 0; padding: 16px; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);" data-qid="${q.questionId}" data-qtype="${q.questionType}" data-required="${q.isRequired}">
                  <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <label class="label" style="font-size:14px; margin:0;">
                      <span style="color:var(--primary); font-weight:700;">Q${idx + 1}.</span> ${esc(q.questionText)}
                      ${q.isRequired ? `<span style="color:var(--danger);">*</span>` : ''}
                    </label>
                  </div>

                  ${
                    q.questionType === 'RATING' ? `
                      <div style="display:flex; gap:10px; align-items:center;">
                        ${[1, 2, 3, 4, 5].map(val => `
                          <label style="display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; border:1px solid var(--border); border-radius:var(--radius-sm); cursor:pointer; background:var(--surface); font-weight:700; transition:all 0.15s ease;">
                            <input type="radio" name="q_${q.questionId}" value="${val}" style="display:none;" ${q.isRequired ? 'required' : ''} />
                            <span>${val}</span>
                          </label>
                        `).join('')}
                      </div>
                    ` : ''
                  }

                  ${
                    q.questionType === 'SINGLE_CHOICE' ? `
                      <div style="display:flex; flex-direction:column; gap:8px;">
                        ${(q.options || []).map(opt => `
                          <label style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); cursor:pointer;">
                            <input type="radio" name="q_${q.questionId}" value="${opt.optionId}" ${q.isRequired ? 'required' : ''} />
                            <span style="font-size:14px;">${esc(opt.optionText)}</span>
                          </label>
                        `).join('')}
                      </div>
                    ` : ''
                  }

                  ${
                    q.questionType === 'MULTI_CHOICE' ? `
                      <div style="display:flex; flex-direction:column; gap:8px;">
                        ${(q.options || []).map(opt => `
                          <label style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); cursor:pointer;">
                            <input type="checkbox" name="q_${q.questionId}" value="${opt.optionId}" />
                            <span style="font-size:14px;">${esc(opt.optionText)}</span>
                          </label>
                        `).join('')}
                      </div>
                    ` : ''
                  }

                  ${
                    q.questionType === 'TEXT' ? `
                      <textarea name="q_${q.questionId}" class="textarea" style="min-height:80px;" placeholder="Your answer here..." ${q.isRequired ? 'required' : ''}></textarea>
                    ` : ''
                  }
                </div>
              `).join('')}

              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                <button type="button" id="cancel-survey-btn" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Submit Response</button>
              </div>
            </form>
          </div>
        </div>
      `;

      function close() { modalEl.innerHTML = ''; }
      modalEl.querySelector('#close-take-survey').onclick = close;
      modalEl.querySelector('#cancel-survey-btn').onclick = close;

      // Handle interactive rating styling
      modalEl.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
          const parent = radio.closest('.field');
          parent.querySelectorAll('label').forEach(l => {
            l.style.background = 'var(--surface)';
            l.style.borderColor = 'var(--border)';
            l.style.color = 'var(--text)';
          });
          radio.parentElement.style.background = 'var(--primary-light)';
          radio.parentElement.style.borderColor = 'var(--primary)';
          radio.parentElement.style.color = 'var(--primary)';
        });
      });

      const form = modalEl.querySelector('#survey-response-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const answers = [];

        for (const q of survey.questions) {
          const qid = q.questionId;
          if (q.questionType === 'RATING') {
            const checked = form.querySelector(`input[name="q_${qid}"]:checked`);
            if (checked) {
              answers.push({ questionId: qid, ratingValue: Number(checked.value) });
            }
          } else if (q.questionType === 'SINGLE_CHOICE') {
            const checked = form.querySelector(`input[name="q_${qid}"]:checked`);
            if (checked) {
              answers.push({ questionId: qid, optionIds: [Number(checked.value)] });
            }
          } else if (q.questionType === 'MULTI_CHOICE') {
            const checkedBoxes = [...form.querySelectorAll(`input[name="q_${qid}"]:checked`)];
            if (checkedBoxes.length) {
              answers.push({ questionId: qid, optionIds: checkedBoxes.map(b => Number(b.value)) });
            }
          } else if (q.questionType === 'TEXT') {
            const txt = form.querySelector(`textarea[name="q_${qid}"]`)?.value.trim();
            if (txt) {
              answers.push({ questionId: qid, answerText: txt });
            }
          }
        }

        try {
          await api.post(`/surveys/${surveyId}/responses`, { answers });
          toast('Thank you! Your survey response has been recorded.', 'success');
          close();
          loadData();
        } catch (err) {
          toast(err.message || 'Submission failed', 'error');
        }
      });
    } catch (err) {
      toast(err.message || 'Could not load survey', 'error');
      modalEl.innerHTML = '';
    }
  }

  async function openViewResponseModal(surveyId) {
    const modalEl = container.querySelector('#survey-modal-container');
    modalEl.innerHTML = loading('Loading your response...');

    try {
      const res = await api.get(`/surveys/${surveyId}/my-response`);
      const response = res.data || res;

      modalEl.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" style="max-width: 600px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <div>
                <span class="badge badge-success">✓ Response Submitted</span>
                <span class="small muted" style="margin-left:8px;">${formatDateTime(response.submittedAt)}</span>
              </div>
              <button id="close-view-response" class="btn btn-ghost btn-sm" style="font-size:18px;">✕</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:20px;">
              ${(response.answers || []).map((a, i) => `
                <div style="padding:12px; background:var(--bg); border:1px solid var(--border-subtle); border-radius:var(--radius-sm);">
                  <strong style="font-size:13px; color:var(--text); display:block; margin-bottom:4px;">
                    ${i + 1}. ${esc(a.questionText)}
                  </strong>
                  <div style="color:var(--primary); font-weight:600; font-size:14px;">
                    ${a.ratingValue ? `★ ${a.ratingValue} / 5` : ''}
                    ${a.optionTexts && a.optionTexts.length ? a.optionTexts.map(t => esc(t)).join(', ') : ''}
                    ${a.answerText ? esc(a.answerText) : ''}
                  </div>
                </div>
              `).join('')}
            </div>

            <div style="text-align:right;">
              <button id="close-resp-btn" class="btn btn-secondary">Done</button>
            </div>
          </div>
        </div>
      `;

      function close() { modalEl.innerHTML = ''; }
      modalEl.querySelector('#close-view-response').onclick = close;
      modalEl.querySelector('#close-resp-btn').onclick = close;
    } catch (err) {
      toast(err.message || 'Could not load response', 'error');
      modalEl.innerHTML = '';
    }
  }

  loadData();
}
