import React from 'react'
import { screen } from '@testing-library/react'
import AlertBanner from '../components/AlertBanner'
import { renderWithProviders } from '../testUtils'

describe('AlertBanner', () => {
  it('renders info tone by default', () => {
    renderWithProviders(<AlertBanner title="Info" description="Something helpful." />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Info')).toBeTruthy()
    expect(screen.getByText('Something helpful.')).toBeTruthy()
  })

  it('renders success tone', () => {
    renderWithProviders(<AlertBanner tone="success" title="Success" description="All good." />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Success')).toBeTruthy()
    expect(screen.getByText('All good.')).toBeTruthy()
  })

  it('renders warning tone', () => {
    renderWithProviders(<AlertBanner tone="warning" title="Warning" description="Be careful." />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Warning')).toBeTruthy()
    expect(screen.getByText('Be careful.')).toBeTruthy()
  })

  it('renders error tone', () => {
    renderWithProviders(<AlertBanner tone="error" title="Error" description="Something failed." />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Error')).toBeTruthy()
    expect(screen.getByText('Something failed.')).toBeTruthy()
  })

  it('renders children', () => {
    renderWithProviders(
      <AlertBanner title="Title" description="Desc">
        <button type="button">Action</button>
      </AlertBanner>
    )
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy()
  })

  it('renders without title', () => {
    renderWithProviders(<AlertBanner description="No title here." />)
    expect(screen.getByText('No title here.')).toBeTruthy()
    expect(screen.queryByText('Info')).toBeNull()
  })

  it('renders without description', () => {
    renderWithProviders(
      <AlertBanner title="Title only">
        <span>Child content</span>
      </AlertBanner>
    )
    expect(screen.getByText('Title only')).toBeTruthy()
    expect(screen.getByText('Child content')).toBeTruthy()
  })
})
