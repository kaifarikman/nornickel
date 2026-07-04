import { useLocation } from 'react-router'
import meshUrl from '@/assets/nornickel-mesh.webp'
import styles from './AppBackground.module.css'

const ROUTE_LAYOUTS: Record<string, (string | undefined)[]> = {
  '/setup': [styles.midRight, styles.bottomLeft],
  '/diagnosis': [styles.topRight],
  '/hypotheses': [styles.midLeft],
  '/graph': [styles.bottomRight, styles.topLeft],
  '/benchmark': [styles.bottomLeft, styles.topRight],
  '/library': [styles.topRight],
  '/report': [styles.midRight],
}

const FALLBACK: (string | undefined)[] = [styles.topRight]

function layoutFor(pathname: string) {
  for (const [route, layout] of Object.entries(ROUTE_LAYOUTS)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return layout
    }
  }
  return FALLBACK
}

export function AppBackground() {
  const { pathname } = useLocation()
  const clouds = layoutFor(pathname)

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {clouds.filter(Boolean).map((cloud, i) => (
        <img key={`${pathname}-${i}`} className={`${styles.mesh} ${cloud}`} src={meshUrl} alt="" />
      ))}
      <span className={`${styles.spark} ${styles.sparkA}`} />
      <span className={`${styles.spark} ${styles.sparkB}`} />
      <span className={`${styles.spark} ${styles.sparkC}`} />
    </div>
  )
}
