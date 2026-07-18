import { ExternalLink } from "lucide-react";

interface RepoLinkProps {
  url: string;
  name: string;
  className?: string;
}

/** Anklickbares Repository-Icon, öffnet die Quelle in einem neuen Tab. */
export function RepoLink({ url, name, className = "catalog-repo-link" }: RepoLinkProps) {
  return (
    <a
      className={className}
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={`Repository von ${name} in neuem Tab öffnen`}
      aria-label={`Repository von ${name} in neuem Tab öffnen`}
      onClick={(event) => event.stopPropagation()}
    >
      <ExternalLink aria-hidden="true" />
    </a>
  );
}
