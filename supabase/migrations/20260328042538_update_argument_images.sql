-- Mise à jour des images par défaut des 4 cartes Arguments
UPDATE site_config SET value = 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80'
WHERE key = 'landing_arg_time_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'
WHERE key = 'landing_arg_money_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80'
WHERE key = 'landing_arg_contract_img';

UPDATE site_config SET value = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80'
WHERE key = 'landing_arg_sleep_img';
