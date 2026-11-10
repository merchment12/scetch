import { ArrowRight, Check, CheckCircle, Lightning, UploadSimple } from '@phosphor-icons/react';
import WarmupPad from './WarmupPad';

export default function Practice({ lesson, progress, onCheck, onComplete, onUpload, onNext, last }) {
  const ready = progress.seen_steps.length === 4 && progress.checks.every(Boolean);
  return <>
    <section className="practice" id="practice">
      <div className="section-line"><span className="eyebrow">ТЕПЕРЬ ТВОЯ ОЧЕРЕДЬ</span><span className="mono muted">{lesson.duration} МИН</span></div>
      <h3>{lesson.task_title}</h3><p>{lesson.task}</p>
      <div className="materials"><PencilLabel /><div><strong>Что подготовить</strong><p>{lesson.materials}</p></div></div>
      <fieldset className="checks"><legend>Проверь себя</legend>{lesson.checks.map((check, index) => <label key={check} className={progress.checks[index] ? 'checked' : ''}><input type="checkbox" checked={progress.checks[index]} onChange={event => onCheck(index, event.target.checked)} /><span className="check-box"><Check size={13} weight="bold" /></span><span>{check}</span></label>)}</fieldset>
      {progress.completed ? <div className="completion" role="status"><CheckCircle size={24} weight="fill" /><div><strong>Урок пройден</strong><span>Сохрани рисунок и продолжай практиковаться.</span></div></div> : <><button className="cta" disabled={!ready} onClick={onComplete}>Завершить урок <CheckCircle size={19} /></button>{!ready && <p className="helper">Изучи все 4 шага и отметь критерии самопроверки. Загрузка рисунка — по желанию.</p>}</>}
      <div className="practice-actions"><button className="secondary-button" onClick={onUpload}><UploadSimple /> Добавить работу</button>{progress.completed && !last && <button className="text-button" onClick={onNext}>Следующий урок <ArrowRight /></button>}</div>
      <p className="helper">В MVP ты оцениваешь работу по критериям самопроверки. Проверка через ИИ появится на следующем этапе.</p>
    </section>
    <div className="challenge"><Lightning size={22} /><div><span className="eyebrow">ЕЩЁ ОДИН ПОДХОД</span><p>{lesson.challenge}</p></div></div>
    <details className="warmup-details"><summary>Открыть черновик и таймер <span className="mono">5:00</span></summary><WarmupPad /></details>
    <details className="reference"><summary>Материалы и источник урока</summary><p>{lesson.source}</p><p>Дополнительно: <strong>{lesson.reference.title}</strong>, {lesson.reference.section} (страница {lesson.reference.pdf_page} в предоставленном PDF).</p><p>Схемы на платформе — упрощённые учебные иллюстрации. Сравнивай принцип построения, а не точное совпадение контура.</p></details>
  </>;
}

function PencilLabel() { return <span className="material-mark" aria-hidden="true">/</span>; }
