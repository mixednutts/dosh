import PropTypes from 'prop-types'
import { useState } from 'react'

import Modal from './Modal'

function ReleaseSection({ title, items }) {
  if (!items.length) return null

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">{title}</h4>
      <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-200">
        {items.map(item => (
          <li key={item} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

ReleaseSection.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
}

function ReleaseCard({ release, tone = 'current' }) {
  if (!release) return null

  const toneClasses = tone === 'update'
    ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/25'
    : 'border-dosh-200 bg-dosh-50 dark:border-dosh-800 dark:bg-dosh-950/25'

  return (
    <section className={`space-y-4 rounded-2xl border p-4 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">v{release.version}</h3>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">{release.release_date}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
          tone === 'update'
            ? 'border-amber-300 bg-white text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
            : 'border-dosh-300 bg-white text-dosh-700 dark:border-dosh-700 dark:bg-dosh-950/40 dark:text-dosh-300'
        }`}>
          {tone === 'update' ? 'Available Update' : 'Current Version'}
        </span>
      </div>
      {release.summary ? <p className="text-sm text-gray-700 dark:text-gray-200">{release.summary}</p> : null}
      <div className="space-y-3">
        {release.sections.map(section => (
          <ReleaseSection key={`${release.version}-${section.title}`} title={section.title} items={section.items} />
        ))}
      </div>
    </section>
  )
}

ReleaseCard.propTypes = {
  release: PropTypes.shape({
    version: PropTypes.string.isRequired,
    release_date: PropTypes.string.isRequired,
    summary: PropTypes.string,
    sections: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string.isRequired,
      items: PropTypes.arrayOf(PropTypes.string).isRequired,
    })).isRequired,
  }),
  tone: PropTypes.oneOf(['current', 'update']),
}

export default function ReleaseNotesModal({ releaseNotes, onClose }) {
  const [showPreviousReleases, setShowPreviousReleases] = useState(false)

  return (
    <Modal title="Release Notes" onClose={onClose} size="xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900/60">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Running Version</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-gray-900 dark:text-white">v{releaseNotes.current_version}</p>
            {releaseNotes.update_available ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {releaseNotes.newer_release_count} newer release{releaseNotes.newer_release_count === 1 ? '' : 's'} available
              </span>
            ) : (
              <span className="rounded-full border border-dosh-300 bg-dosh-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-dosh-700 dark:border-dosh-700 dark:bg-dosh-950/40 dark:text-dosh-300">
                Up to date
              </span>
            )}
          </div>
        </div>

        {releaseNotes.current_release ? <ReleaseCard release={releaseNotes.current_release} tone="current" /> : null}

        {releaseNotes.newer_releases.length ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Available Updates</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                These released updates are newer than the version currently running in this app.
              </p>
            </div>
            {releaseNotes.newer_releases.map(release => (
              <ReleaseCard key={release.version} release={release} tone="update" />
            ))}
          </div>
        ) : null}

        {releaseNotes.previous_releases.length ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900/60">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Previous Releases</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Browse older released versions that came before the app version currently running here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviousReleases(current => !current)}
                className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-dosh-400 hover:bg-dosh-50 hover:text-dosh-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-dosh-700 dark:hover:bg-dosh-950/40 dark:hover:text-white"
              >
                {showPreviousReleases ? 'Hide previous releases' : `View previous releases (${releaseNotes.previous_release_count})`}
              </button>
            </div>
            {showPreviousReleases ? (
              <div className="space-y-3">
                {releaseNotes.previous_releases.map(release => (
                  <ReleaseCard key={release.version} release={release} tone="current" />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

ReleaseNotesModal.propTypes = {
  releaseNotes: PropTypes.shape({
    current_version: PropTypes.string.isRequired,
    update_available: PropTypes.bool.isRequired,
    newer_release_count: PropTypes.number.isRequired,
    previous_release_count: PropTypes.number.isRequired,
    current_release: PropTypes.object,
    newer_releases: PropTypes.arrayOf(PropTypes.object).isRequired,
    previous_releases: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
}
