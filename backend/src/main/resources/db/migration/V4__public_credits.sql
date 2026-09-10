ALTER TABLE uploads ADD COLUMN public_credits varchar(1000) NOT NULL DEFAULT '';
ALTER TABLE tracks ADD COLUMN public_credits varchar(1000) NOT NULL DEFAULT '';
UPDATE tracks SET public_credits='Original synthetic audio by Unison Lab. Distributed under the Unison project MIT license; see the repository LICENSE and docs/audio-provenance.md.' WHERE id IN ('first-light','slow-orbit','tidal');
