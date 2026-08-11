import { Component } from 'react';
import { RefreshCw } from 'lucide-react';
import i18n from '../../i18n/index.js';
import { isChunkLoadError, recoverFromChunkLoadError } from '../../utils/chunkRecovery.js';

class ChunkErrorBoundary extends Component {
  state = {
    error: null,
    isChunkError: false,
  };

  static getDerivedStateFromError(error) {
    return {
      error,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error) {
    if (recoverFromChunkLoadError(error)) {
      return;
    }

    console.error('Unhandled route render error', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const titleKey = this.state.isChunkError ? 'common.recovery.updateTitle' : 'common.recovery.errorTitle';
    const bodyKey = this.state.isChunkError ? 'common.recovery.updateBody' : 'common.recovery.errorBody';

    return (
      <main className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
            <RefreshCw size={28} />
          </div>
          <h1 className="text-2xl font-bold">{i18n.t(titleKey)}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{i18n.t(bodyKey)}</p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
          >
            <RefreshCw size={18} />
            {i18n.t('common.recovery.reload')}
          </button>
        </section>
      </main>
    );
  }
}

export default ChunkErrorBoundary;
