import { memo, useState } from 'react';
import { Cube, PencilSimple } from '@phosphor-icons/react';
import { coupeMilestones } from '../car/reference';
import CarVolume from './CarVolume';
import '../car-project.css';

function ReferenceProject({ chapter, onChapter }) {
  const [view, setView] = useState('sketch');
  return <section className="reference-project" aria-label="Цель последнего урока: спортивное купе">
    <div className="reference-project-heading"><div><span className="eyebrow">ФИНАЛЬНЫЙ ПРОЕКТ / ПО ТВОЕМУ РЕФЕРЕНСУ</span><h3>От опорных точек к спортивному купе</h3></div><span className="reference-project-badge mono">ФИНАЛ / ПРОЕКТ</span></div>
    <div className="project-view-tabs" aria-label="Вид финального проекта"><button className={view === 'sketch' ? 'active' : ''} aria-pressed={view === 'sketch'} onClick={() => setView('sketch')}><PencilSimple /> Цель урока</button><button className={view === 'volume' ? 'active' : ''} aria-pressed={view === 'volume'} onClick={() => setView('volume')}><Cube /> Повернуть в 3D</button></div>
    {view === 'sketch' ? <div className="project-target"><img src="/sketches/coupe.svg" alt="Учебная интерпретация присланного референса: спортивное купе с длинным капотом справа, низкой крышей и крупными колёсами" /><div className="project-target-caption"><span className="mono">К ЧЕМУ СТРЕМИМСЯ</span><p>Сохраняем характер референса: длинный капот, кабина сдвинута назад, крупные колёса и спокойная пластика боковины. Это учебная интерпретация присланного рисунка.</p></div></div> : <CarVolume chapter={chapter} />}
    <div className="project-milestones" aria-label="Этапы финального проекта">{coupeMilestones.map((item, index) => <button key={item.title} className={chapter === index ? 'active' : ''} onClick={() => onChapter(index)} aria-label={`0${index + 1} ${item.title}`} aria-current={chapter === index ? 'step' : undefined}><span className="mono">0{index + 1}</span><span>{item.title}</span></button>)}</div>
    <p className="project-stage-explanation">{coupeMilestones[chapter].description}</p>
  </section>;
}

export default memo(ReferenceProject);
