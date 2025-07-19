import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Target, Users, Clock, X, Check } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { 
  getPlayerAchievementStats, 
  getUserAchievements, 
  checkPlayerAchievements 
} from '../../utils/matchmaking';

interface AchievementDisplayProps {
  className?: string;
}

export default function AchievementDisplay({ className = '' }: AchievementDisplayProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const loadAchievementData = async () => {
      setLoading(true);
      try {
        const [statsData, achievementsData, earnedData] = await Promise.all([
          getPlayerAchievementStats(user.id),
          getUserAchievements(user.id),
          checkPlayerAchievements(user.id)
        ]);

        setStats(statsData);
        setAchievements(achievementsData);
        setEarnedAchievements(earnedData);
      } catch (error) {
        console.error('Error loading achievement data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAchievementData();
  }, [user?.id]);

  if (!user) {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 ${className}`}>
        <div className="text-center">
          <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Login Required</h3>
          <p className="text-gray-400">Please log in to view achievements</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 ${className}`}>
        <div className="text-center">
          <div className="animate-spin w-12 h-12 text-blue-400 mx-auto mb-4">
            <Trophy className="w-full h-full" />
          </div>
          <p className="text-gray-400">Loading achievements...</p>
        </div>
      </div>
    );
  }

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'skull': return <Target className="w-5 h-5" />;
      case 'fire': return <Award className="w-5 h-5" />;
      case 'flag': return <X className="w-5 h-5" />;
      case 'shield': return <Shield className="w-5 h-5" />;
      case 'crown': return <Crown className="w-5 h-5" />;
      case 'star': return <Star className="w-5 h-5" />;
      case 'handshake': return <Handshake className="w-5 h-5" />;
      default: return <Trophy className="w-5 h-5" />;
    }
  };

  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
          Achievements
        </h3>
        <div className="text-sm text-gray-400">
          {achievements.length} earned
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <h4 className="text-white font-medium mb-3">Game Statistics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Games Played:</span>
              <span className="text-white font-medium">{stats.total_games_played}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Games Won:</span>
              <span className="text-green-400 font-medium">{stats.games_won}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Games Lost:</span>
              <span className="text-red-400 font-medium">{stats.games_lost}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Win Rate:</span>
              <span className="text-white font-medium">
                {stats.total_games_played > 0 
                  ? Math.round((stats.games_won / stats.total_games_played) * 100) 
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Forfeited:</span>
              <span className="text-orange-400 font-medium">{stats.games_forfeited}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Canceled:</span>
              <span className="text-yellow-400 font-medium">{stats.games_canceled}</span>
            </div>
          </div>
        </div>
      )}

      {/* Achievements List */}
      <div className="space-y-3">
        <h4 className="text-white font-medium mb-3">Earned Achievements</h4>
        {achievements.length === 0 ? (
          <div className="text-center py-8">
            <Medal className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No achievements earned yet</p>
            <p className="text-gray-500 text-sm mt-2">Keep playing to unlock achievements!</p>
          </div>
        ) : (
          achievements.map((achievement) => (
            <div key={achievement.id} className="bg-gray-700/30 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-green-400">
                    {getIcon(achievement.icon)}
                  </div>
                  <div>
                    <h5 className="text-white font-medium">{achievement.name}</h5>
                    <p className="text-gray-400 text-sm">{achievement.description}</p>
                    {achievement.reward_type && achievement.reward_value && (
                      <p className="text-blue-400 text-xs mt-1">
                        Reward: {achievement.reward_value}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 text-sm">
                    <Check className="w-4 h-4 inline mr-1" />
                    Earned
                  </div>
                  <div className="text-gray-500 text-xs">
                    {new Date(achievement.earned_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Placeholder icons (you can replace with actual Lucide icons)
const Shield = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const Crown = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
  </svg>
);

const Star = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const Handshake = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
  </svg>
); 