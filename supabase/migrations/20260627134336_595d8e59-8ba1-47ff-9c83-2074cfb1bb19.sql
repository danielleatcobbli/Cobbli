
update services set name = 'Shoe has scratches or stains', card_name = 'Shoe has scratches or stains'
  where slug = 'color-restoration';
update services set name = 'Leather or suede looks dull or dry', card_name = 'Leather or suede looks dull or dry'
  where slug = 'leather-or-suede-conditioning';
update services set name = 'Shoes need a shine', card_name = 'Shoes need a shine'
  where slug = 'shoe-shine';

update services set card_price_label = '$25' where slug = 'waterproofing';

delete from service_variants
  where service_id = 'fb12fafb-fc70-453b-a8bf-667439bbf025'
    and variant_key in ('ankle_boots','boots');

update service_variants
  set variant_label = 'Waterproofing', standard_cents = 2500, premium_cents = 2500, rank = 0
  where service_id = 'fb12fafb-fc70-453b-a8bf-667439bbf025' and variant_key = 'other';
