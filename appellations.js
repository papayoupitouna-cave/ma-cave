// Appellations françaises courantes : nom -> [région, type par défaut]
// Sert à compléter automatiquement la région et la couleur lors de la saisie.
window.APPELLATIONS = {
  // Bordeaux
  'Bordeaux':['Bordeaux, France','rouge'],'Bordeaux Supérieur':['Bordeaux, France','rouge'],'Médoc':['Bordeaux, France','rouge'],'Haut-Médoc':['Bordeaux, France','rouge'],
  'Margaux':['Bordeaux, France','rouge'],'Pauillac':['Bordeaux, France','rouge'],'Saint-Julien':['Bordeaux, France','rouge'],'Saint-Estèphe':['Bordeaux, France','rouge'],
  'Listrac-Médoc':['Bordeaux, France','rouge'],'Moulis-en-Médoc':['Bordeaux, France','rouge'],'Pessac-Léognan':['Bordeaux, France','rouge'],'Graves':['Bordeaux, France','rouge'],
  'Saint-Émilion':['Bordeaux, France','rouge'],'Saint-Émilion Grand Cru':['Bordeaux, France','rouge'],'Pomerol':['Bordeaux, France','rouge'],'Lalande-de-Pomerol':['Bordeaux, France','rouge'],
  'Fronsac':['Bordeaux, France','rouge'],'Canon-Fronsac':['Bordeaux, France','rouge'],'Côtes de Bourg':['Bordeaux, France','rouge'],'Blaye Côtes de Bordeaux':['Bordeaux, France','rouge'],
  'Castillon Côtes de Bordeaux':['Bordeaux, France','rouge'],'Entre-Deux-Mers':['Bordeaux, France','blanc'],'Sauternes':['Bordeaux, France','doux'],'Barsac':['Bordeaux, France','doux'],
  'Loupiac':['Bordeaux, France','doux'],'Cadillac':['Bordeaux, France','doux'],'Crémant de Bordeaux':['Bordeaux, France','eff_blanc'],
  // Bourgogne & Beaujolais
  'Bourgogne':['Bourgogne, France','rouge'],'Bourgogne Aligoté':['Bourgogne, France','blanc'],'Chablis':['Bourgogne, France','blanc'],'Chablis Premier Cru':['Bourgogne, France','blanc'],
  'Chablis Grand Cru':['Bourgogne, France','blanc'],'Petit Chablis':['Bourgogne, France','blanc'],'Irancy':['Bourgogne, France','rouge'],'Gevrey-Chambertin':['Bourgogne, France','rouge'],
  'Chambolle-Musigny':['Bourgogne, France','rouge'],'Morey-Saint-Denis':['Bourgogne, France','rouge'],'Vougeot':['Bourgogne, France','rouge'],'Clos de Vougeot':['Bourgogne, France','rouge'],
  'Vosne-Romanée':['Bourgogne, France','rouge'],'Nuits-Saint-Georges':['Bourgogne, France','rouge'],'Marsannay':['Bourgogne, France','rouge'],'Fixin':['Bourgogne, France','rouge'],
  'Côte de Nuits-Villages':['Bourgogne, France','rouge'],'Aloxe-Corton':['Bourgogne, France','rouge'],'Corton':['Bourgogne, France','rouge'],'Corton-Charlemagne':['Bourgogne, France','blanc'],
  'Savigny-lès-Beaune':['Bourgogne, France','rouge'],'Beaune':['Bourgogne, France','rouge'],'Pommard':['Bourgogne, France','rouge'],'Volnay':['Bourgogne, France','rouge'],
  'Monthélie':['Bourgogne, France','rouge'],'Auxey-Duresses':['Bourgogne, France','rouge'],'Saint-Romain':['Bourgogne, France','blanc'],'Meursault':['Bourgogne, France','blanc'],
  'Puligny-Montrachet':['Bourgogne, France','blanc'],'Chassagne-Montrachet':['Bourgogne, France','blanc'],'Saint-Aubin':['Bourgogne, France','blanc'],'Santenay':['Bourgogne, France','rouge'],
  'Maranges':['Bourgogne, France','rouge'],'Hautes-Côtes de Beaune':['Bourgogne, France','rouge'],'Hautes-Côtes de Nuits':['Bourgogne, France','rouge'],'Rully':['Bourgogne, France','blanc'],
  'Mercurey':['Bourgogne, France','rouge'],'Givry':['Bourgogne, France','rouge'],'Montagny':['Bourgogne, France','blanc'],'Mâcon':['Bourgogne, France','blanc'],
  'Mâcon-Villages':['Bourgogne, France','blanc'],'Viré-Clessé':['Bourgogne, France','blanc'],'Saint-Véran':['Bourgogne, France','blanc'],'Pouilly-Fuissé':['Bourgogne, France','blanc'],
  'Crémant de Bourgogne':['Bourgogne, France','eff_blanc'],'Beaujolais':['Beaujolais, France','rouge'],'Beaujolais-Villages':['Beaujolais, France','rouge'],'Brouilly':['Beaujolais, France','rouge'],
  'Côte de Brouilly':['Beaujolais, France','rouge'],'Chiroubles':['Beaujolais, France','rouge'],'Chénas':['Beaujolais, France','rouge'],'Fleurie':['Beaujolais, France','rouge'],
  'Juliénas':['Beaujolais, France','rouge'],'Morgon':['Beaujolais, France','rouge'],'Moulin-à-Vent':['Beaujolais, France','rouge'],'Régnié':['Beaujolais, France','rouge'],'Saint-Amour':['Beaujolais, France','rouge'],
  // Champagne
  'Champagne':['Champagne, France','eff_blanc'],'Coteaux Champenois':['Champagne, France','blanc'],'Rosé des Riceys':['Champagne, France','rose'],
  // Alsace, Jura, Savoie
  'Alsace':['Alsace, France','blanc'],'Alsace Grand Cru':['Alsace, France','blanc'],'Crémant d\'Alsace':['Alsace, France','eff_blanc'],
  'Côtes du Jura':['Jura, France','blanc'],'Arbois':['Jura, France','blanc'],'Château-Chalon':['Jura, France','blanc'],'L\'Étoile':['Jura, France','blanc'],'Crémant du Jura':['Jura, France','eff_blanc'],
  'Savoie':['Savoie, France','blanc'],'Roussette de Savoie':['Savoie, France','blanc'],
  // Loire
  'Muscadet Sèvre et Maine':['Loire, France','blanc'],'Muscadet':['Loire, France','blanc'],'Anjou':['Loire, France','rouge'],'Rosé d\'Anjou':['Loire, France','rose'],'Cabernet d\'Anjou':['Loire, France','rose'],
  'Savennières':['Loire, France','blanc'],'Coteaux du Layon':['Loire, France','doux'],'Quarts de Chaume':['Loire, France','doux'],'Bonnezeaux':['Loire, France','doux'],
  'Saumur':['Loire, France','blanc'],'Saumur-Champigny':['Loire, France','rouge'],'Crémant de Loire':['Loire, France','eff_blanc'],'Chinon':['Loire, France','rouge'],
  'Bourgueil':['Loire, France','rouge'],'Saint-Nicolas-de-Bourgueil':['Loire, France','rouge'],'Vouvray':['Loire, France','blanc'],'Montlouis-sur-Loire':['Loire, France','blanc'],
  'Touraine':['Loire, France','blanc'],'Cheverny':['Loire, France','blanc'],'Sancerre':['Loire, France','blanc'],'Pouilly-Fumé':['Loire, France','blanc'],
  'Menetou-Salon':['Loire, France','blanc'],'Quincy':['Loire, France','blanc'],'Reuilly':['Loire, France','blanc'],
  // Rhône
  'Côtes du Rhône':['Rhône, France','rouge'],'Côtes du Rhône Villages':['Rhône, France','rouge'],'Côte-Rôtie':['Rhône, France','rouge'],'Condrieu':['Rhône, France','blanc'],
  'Château-Grillet':['Rhône, France','blanc'],'Saint-Joseph':['Rhône, France','rouge'],'Crozes-Hermitage':['Rhône, France','rouge'],'Hermitage':['Rhône, France','rouge'],
  'Cornas':['Rhône, France','rouge'],'Saint-Péray':['Rhône, France','blanc'],'Gigondas':['Rhône, France','rouge'],'Vacqueyras':['Rhône, France','rouge'],
  'Châteauneuf-du-Pape':['Rhône, France','rouge'],'Lirac':['Rhône, France','rouge'],'Tavel':['Rhône, France','rose'],'Rasteau':['Rhône, France','rouge'],
  'Cairanne':['Rhône, France','rouge'],'Vinsobres':['Rhône, France','rouge'],'Beaumes-de-Venise':['Rhône, France','rouge'],'Muscat de Beaumes-de-Venise':['Rhône, France','doux'],
  'Ventoux':['Rhône, France','rouge'],'Luberon':['Rhône, France','rouge'],'Costières de Nîmes':['Rhône, France','rouge'],'Clairette de Die':['Rhône, France','eff_blanc'],
  // Provence, Corse
  'Côtes de Provence':['Provence, France','rose'],'Coteaux d\'Aix-en-Provence':['Provence, France','rose'],'Bandol':['Provence, France','rouge'],'Cassis':['Provence, France','blanc'],
  'Palette':['Provence, France','rouge'],'Bellet':['Provence, France','rouge'],'Les Baux-de-Provence':['Provence, France','rouge'],
  'Corse':['Corse, France','rouge'],'Patrimonio':['Corse, France','rouge'],'Ajaccio':['Corse, France','rouge'],
  // Languedoc-Roussillon
  'Languedoc':['Languedoc, France','rouge'],'Pic Saint-Loup':['Languedoc, France','rouge'],'Terrasses du Larzac':['Languedoc, France','rouge'],'Faugères':['Languedoc, France','rouge'],
  'Saint-Chinian':['Languedoc, France','rouge'],'Minervois':['Languedoc, France','rouge'],'Minervois-La Livinière':['Languedoc, France','rouge'],'Corbières':['Languedoc, France','rouge'],
  'Fitou':['Languedoc, France','rouge'],'Picpoul de Pinet':['Languedoc, France','blanc'],'Limoux':['Languedoc, France','blanc'],'Crémant de Limoux':['Languedoc, France','eff_blanc'],
  'Blanquette de Limoux':['Languedoc, France','eff_blanc'],'Côtes du Roussillon':['Roussillon, France','rouge'],'Côtes du Roussillon Villages':['Roussillon, France','rouge'],
  'Collioure':['Roussillon, France','rouge'],'Banyuls':['Roussillon, France','doux'],'Maury':['Roussillon, France','doux'],'Rivesaltes':['Roussillon, France','doux'],'Muscat de Rivesaltes':['Roussillon, France','doux'],
  // Sud-Ouest
  'Cahors':['Sud-Ouest, France','rouge'],'Madiran':['Sud-Ouest, France','rouge'],'Pacherenc du Vic-Bilh':['Sud-Ouest, France','doux'],'Jurançon':['Sud-Ouest, France','doux'],
  'Jurançon sec':['Sud-Ouest, France','blanc'],'Irouléguy':['Sud-Ouest, France','rouge'],'Bergerac':['Sud-Ouest, France','rouge'],'Pécharmant':['Sud-Ouest, France','rouge'],
  'Monbazillac':['Sud-Ouest, France','doux'],'Buzet':['Sud-Ouest, France','rouge'],'Fronton':['Sud-Ouest, France','rouge'],'Gaillac':['Sud-Ouest, France','rouge'],'Marcillac':['Sud-Ouest, France','rouge'],
  'Côtes de Gascogne':['Sud-Ouest, France','blanc']
};
