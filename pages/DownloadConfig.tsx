import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { request } from '../services/api';

interface DownloadConfigProps {
  onBack: () => void;
}

interface DownloadConfigData {
  downloadUrl: string;
}

const DownloadConfig: React.FC<DownloadConfigProps> = ({ onBack }) => {
  const [downloadUrl, setDownloadUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response: DownloadConfigData = await request('/download/admin/download-config', {
        method: 'GET'
      });
      setDownloadUrl(response.downloadUrl || '');
    } catch (error) {
      console.error('获取下载配置失败:', error);
      setMessage({ type: 'error', text: '获取配置失败，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!downloadUrl.trim()) {
      setMessage({ type: 'error', text: '请输入下载链接' });
      return;
    }

    setSaving(true);
    try {
      await request('/download/admin/download-config', {
        method: 'PUT',
        body: JSON.stringify({ downloadUrl: downloadUrl.trim() })
      });
      setMessage({ type: 'success', text: '配置更新成功' });
    } catch (error) {
      console.error('更新下载配置失败:', error);
      setMessage({ type: 'error', text: '更新失败，请稍后重试' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">返回</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex items-center">
            <Settings className="text-[#1E40AF] mr-2" size={20} />
            下载链接配置
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E40AF]" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
            {message && (
              <div
                className={`flex items-center space-x-2 p-3 rounded-xl ${
                  message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                蓝奏云下载链接
              </label>
              <input
                type="url"
                value={downloadUrl}
                onChange={(e) => {
                  setDownloadUrl(e.target.value);
                  setMessage(null);
                }}
                placeholder="请输入蓝奏云下载链接..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/50 focus:border-[#1E40AF] text-sm"
              />
              <p className="text-xs text-gray-400 mt-2">
                请输入有效的蓝奏云链接，用户将通过此链接下载应用
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 ${
                saving
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-[#1E40AF] text-white hover:bg-[#1E40AF]/90 active:scale-[0.98] transition-all'
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>保存配置</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadConfig;