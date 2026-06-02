'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  isDefault: boolean;
}

export default function RoundTableForm() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [agentCount, setAgentCount] = useState(2);
  const [maxRounds, setMaxRounds] = useState(2);
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Persona management
  const [availablePersonas, setAvailablePersonas] = useState<Persona[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true);

  // Fetch available personas on mount
  useEffect(() => {
    fetchPersonas();
  }, []);

  // Auto-select first N personas when agent count changes
  useEffect(() => {
    if (availablePersonas.length > 0 && selectedPersonaIds.length === 0) {
      setSelectedPersonaIds(availablePersonas.slice(0, agentCount).map(p => p.id));
    }
  }, [availablePersonas, agentCount, selectedPersonaIds.length]);

  const fetchPersonas = async () => {
    try {
      const response = await fetch('/api/personas');
      if (!response.ok) throw new Error('加载智能体人格失败');
      const data = await response.json();
      setAvailablePersonas(data.personas);

      // Auto-select first agentCount personas
      if (data.personas.length >= agentCount) {
        setSelectedPersonaIds(data.personas.slice(0, agentCount).map((p: Persona) => p.id));
      }
    } catch (err) {
      console.error('Error fetching personas:', err);
      setError('加载智能体人格失败，请刷新页面重试。');
    } finally {
      setIsLoadingPersonas(false);
    }
  };

  const handleAgentCountChange = (count: number) => {
    setAgentCount(count);

    // Adjust selected personas
    if (count > selectedPersonaIds.length) {
      // Add more personas from available ones
      const remaining = availablePersonas
        .filter(p => !selectedPersonaIds.includes(p.id))
        .map(p => p.id);
      const toAdd = remaining.slice(0, count - selectedPersonaIds.length);
      setSelectedPersonaIds([...selectedPersonaIds, ...toAdd]);
    } else if (count < selectedPersonaIds.length) {
      // Remove excess personas
      setSelectedPersonaIds(selectedPersonaIds.slice(0, count));
    }
  };

  const handlePersonaSelect = (index: number, personaId: string) => {
    const newSelection = [...selectedPersonaIds];
    newSelection[index] = personaId;
    setSelectedPersonaIds(newSelection);
  };

  const handleCreate = async () => {
    setError('');

    // Validation
    if (!topic.trim()) {
      setError('请输入讨论主题');
      return;
    }

    if (agentCount < 2 || agentCount > 6) {
      setError('智能体数量必须在 2 到 6 之间');
      return;
    }

    if (selectedPersonaIds.length !== agentCount) {
      setError(`请选择 ${agentCount} 个参与讨论的智能体`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/roundtable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic.trim(),
          agentCount,
          maxRounds,
          selectedPersonaIds,
          language,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '创建圆桌讨论失败');
      }

      const data = await response.json();
      router.push(`/roundtable/${data.roundTable.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingPersonas) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-12">
        <div className="text-lg">正在加载智能体人格...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">发起圆桌讨论</h2>
          <button
            onClick={() => router.push('/personas')}
            className="text-sm px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
          >
            管理人格
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Topic Input */}
        <div className="mb-6">
          <label htmlFor="topic" className="block text-sm font-medium mb-2">
            讨论主题
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="你想讨论什么？例如：AI 是否应该拥有权利？远程办公的未来是什么？"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        {/* Agent Count Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            智能体数量
          </label>
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handleAgentCountChange(count)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${agentCount === count
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                disabled={isSubmitting}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            选择智能体（{selectedPersonaIds.length}/{agentCount}）
          </label>
          <div className="space-y-3">
            {Array.from({ length: agentCount }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium w-20">智能体 {index + 1}：</span>
                <select
                  value={selectedPersonaIds[index] || ''}
                  onChange={(e) => handlePersonaSelect(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  disabled={isSubmitting}
                >
                  <option value="">选择一个人格...</option>
                  {availablePersonas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name} - {persona.description}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {availablePersonas.length === 0 && (
            <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
              暂无可用人格。请先到“管理人格”页面创建。
            </p>
          )}
        </div>

        {/* Language Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            讨论语言
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="zh"
                checked={language === 'zh'}
                onChange={(e) => setLanguage(e.target.value as 'zh')}
                className="mr-2"
                disabled={isSubmitting}
              />
              <span className="text-sm">中文</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="en"
                checked={language === 'en'}
                onChange={(e) => setLanguage(e.target.value as 'en')}
                className="mr-2"
                disabled={isSubmitting}
              />
              <span className="text-sm">英文</span>
            </label>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            智能体会使用所选语言回复
          </p>
        </div>

        {/* Max Rounds Input */}
        <div className="mb-6">
          <label htmlFor="maxRounds" className="block text-sm font-medium mb-2">
            最大轮数
          </label>
          <input
            id="maxRounds"
            type="number"
            value={maxRounds}
            onChange={(e) => setMaxRounds(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
            min={1}
            max={50}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            disabled={isSubmitting}
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            本次讨论最多进行 {maxRounds} 轮
          </p>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleCreate}
          disabled={isSubmitting || !topic.trim() || selectedPersonaIds.length !== agentCount}
          className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors ${isSubmitting || !topic.trim() || selectedPersonaIds.length !== agentCount
            ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
            }`}
        >
          {isSubmitting ? '创建中...' : '开始讨论'}
        </button>
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
          说明
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
          <li>• 智能体会按轮次依次讨论你的主题</li>
          <li>• 每个智能体都有独立视角和人格设定</li>
          <li>• 智能体可以搜索网页来支撑观点</li>
          <li>• 点击“开始第 X 轮”继续推进讨论</li>
        </ul>
      </div>
    </div>
  );
}
