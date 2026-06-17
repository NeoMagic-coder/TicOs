# OneProduct whitepaper Makefile.
# Requires: pdflatex, bibtex (texlive medium scheme is enough).

PAPER  := paper
TEX    := $(PAPER).tex
PDF    := $(PAPER).pdf
BIB    := refs.bib

.PHONY: all clean watch view

all: $(PDF)

$(PDF): $(TEX) $(BIB) oneproduct.bst
	pdflatex -interaction=nonstopmode $(PAPER) > /dev/null
	bibtex $(PAPER) > /dev/null || true
	pdflatex -interaction=nonstopmode $(PAPER) > /dev/null
	pdflatex -interaction=nonstopmode $(PAPER) > /dev/null
	@echo "→ $(PDF)"

watch:
	@command -v latexmk >/dev/null || { echo "latexmk gerekiyor"; exit 1; }
	latexmk -pdf -pvc $(PAPER)

view: $(PDF)
	@open $(PDF) 2>/dev/null || xdg-open $(PDF) 2>/dev/null || echo "PDF açılamadı"

clean:
	rm -f $(PAPER).{aux,bbl,blg,log,out,toc,nav,snm,vrb,fls,fdb_latexmk,synctex.gz}
	rm -f $(PDF)
