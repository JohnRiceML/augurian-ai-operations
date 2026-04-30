"""Scheduled API pullers and the manual-dump normalizer.

One script per source, by design. The GA4 puller is the canonical
pattern; the others are deliberate copies. Don't generalize — three
50-line scripts are easier to maintain than one 200-line abstraction.
"""
