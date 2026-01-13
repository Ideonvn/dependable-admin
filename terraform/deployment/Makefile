setup:
	terraform init

prepare:
	terraform validate
	terraform plan

provision:
	terraform apply --auto-approve

destroy:
	terraform destroy --auto-approve

output:
	terraform output

refresh:
	terraform refresh

format:
	terraform fmt -recursive
