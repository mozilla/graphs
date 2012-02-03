CREATE TABLE IF NOT EXISTS machines (
   id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
   os_id INT UNSIGNED NOT NULL,
   is_throttling TINYINT UNSIGNED NOT NULL DEFAULT '0',
   cpu_speed VARCHAR(255),
   name VARCHAR(255) NOT NULL,
   is_active TINYINT UNSIGNED NOT NULL DEFAULT '0',
   date_added INT UNSIGNED NOT NULL,

   PRIMARY KEY (id),
   UNIQUE KEY (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS os_list (
   id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
   name VARCHAR(255) NOT NULL,

   PRIMARY KEY (id),
   UNIQUE KEY (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tests (
   id MEDIUMINT UNSIGNED NOT NULL AUTO_INCREMENT,
   name VARCHAR(255) NOT NULL,
   pretty_name VARCHAR(255),
   is_chrome TINYINT UNSIGNED NOT NULL DEFAULT '0',
   is_active TINYINT UNSIGNED NOT NULL DEFAULT '0',
   pageset_id INT UNSIGNED,

   PRIMARY KEY (id),
   UNIQUE KEY (name),
   KEY (pageset_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS branches (
   id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
   name VARCHAR(255) NOT NULL,

   PRIMARY KEY (id),
   UNIQUE KEY (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS builds (
   id INT UNSIGNED NOT NULL AUTO_INCREMENT,
   ref_build_id BIGINT UNSIGNED,
   ref_changeset VARCHAR(255),
   branch_id SMALLINT UNSIGNED NOT NULL,
   date_added INT UNSIGNED NOT NULL,

   PRIMARY KEY (id),
   KEY (ref_changeset),
   KEY (ref_build_id),
   KEY (branch_id, date_added)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagesets (
   id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
   name VARCHAR(255) NOT NULL,

   PRIMARY KEY (id),
   UNIQUE KEY (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pages (
   id INT UNSIGNED NOT NULL AUTO_INCREMENT,
   pageset_id SMALLINT UNSIGNED NOT NULL,
   name VARCHAR(255) NOT NULL,

   PRIMARY KEY (id),
   UNIQUE KEY (pageset_id, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS test_runs (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
   machine_id SMALLINT UNSIGNED NOT NULL,
   test_id MEDIUMINT UNSIGNED NOT NULL,
   build_id INT UNSIGNED NOT NULL,
   run_number TINYINT UNSIGNED NOT NULL DEFAULT '0',
   date_run INT UNSIGNED NOT NULL,
   average FLOAT,

   PRIMARY KEY (id),
   KEY (test_id, build_id),
   KEY (test_id, build_id, date_run)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS test_run_values (
   test_run_id INT UNSIGNED NOT NULL,
   interval_id SMALLINT UNSIGNED NOT NULL,
   value FLOAT NOT NULL,
   page_id INT UNSIGNED,

   PRIMARY KEY (test_run_id, interval_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS annotations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_run_id int UNSIGNED NOT NULL,
  note text NOT NULL,
  bug_id INT UNSIGNED NOT NULL,

  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS valid_test_combinations_updated (
  -- This matches test_runs.date_run:
  last_updated INT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS valid_test_combinations (
  test_id INT NOT NULL,
  branch_id INT NOT NULL,
  os_id INT NOT NULL
) ENGINE=InnoDB;
