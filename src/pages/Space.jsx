import { useParams } from 'react-router-dom';
import { useCategories } from '../components/ui.jsx';
import Studies from './Studies.jsx';
import Finance from './Finance.jsx';
import { GlowUp, Social, Personal, Sport, Beauty } from './SpacesLife.jsx';
import { Projects, Career, Languages, Habits, Reading, GenericSpace } from './SpacesGrowth.jsx';

const MAP = { etudes: Studies, finances: Finance, glowup: GlowUp, social: Social, perso: Personal, sport: Sport, beaute: Beauty, projets: Projects, carriere: Career, langues: Languages, habitudes: Habits, lecture: Reading };

export default function Space() {
  const { id } = useParams();
  const cat = useCategories().find((c) => c.id === id);
  if (!cat) return <p className="muted">Cet espace n'existe plus (catégorie supprimée).</p>;
  const C = MAP[cat.space] || GenericSpace;
  return <C cat={cat} key={cat.id} />;
}
