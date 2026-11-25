import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

export default function MatchModal({ match, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="match-title" onClick={onClose}>
      <div className="modal match-modal" onClick={(e) => e.stopPropagation()}>
        <div className="match-avatars">
          <Avatar name={user.name} photo={user.photos?.[0]?.url} size={96} />
          <span className="match-heart"><Icon name="key" size={22} /></span>
          <Avatar name={match.user.name} photo={match.user.photos?.[0]?.url} size={96} />
        </div>
        <h2 id="match-title">You both said yes</h2>
        <p>You and {match.user.name.split(' ')[0]} would both like to live together, and you're <b>{match.score}% compatible</b>.</p>
        <div className="row gap">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Keep looking</button>
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/chat/${match.matchId}`)}>
            <Icon name="send" size={18} /> Say hi
          </button>
        </div>
      </div>
    </div>
  );
}
